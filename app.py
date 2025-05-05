import os
import sys
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
import google.generativeai as genai
# Import datetime if you plan to use the created_at field later
# from datetime import datetime

print("---Python script starting---")

app = Flask(__name__)

# --- Database Configuration ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set.", file=sys.stderr)
    # sys.exit("Database URL not found. Exiting.") # Optional: Exit if critical

# Ensure the scheme is postgresql for SQLAlchemy compatibility
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# --- End Database Configuration ---

# --- Initialize SQLAlchemy AFTER configuration ---
db = SQLAlchemy(app)
# --- End Initialization ---


# !!! IMPORTANT: DATABASE RESET LOGIC !!!
# Check for a reset flag environment variable BEFORE defining models
if os.environ.get('RESET_DB') == 'TRUE':
    print("RESET_DB environment variable set to TRUE. Dropping and recreating tables.", file=sys.stderr)
    with app.app_context():
        try:
            db.drop_all()
            print("Tables dropped successfully.", file=sys.stderr)
            db.create_all()
            print("Tables recreated successfully based on models.", file=sys.stderr)
            db.session.commit()
            print("Database session committed after reset.", file=sys.stderr)
        except Exception as e:
            print(f"Error during DB reset (drop/create): {e}", file=sys.stderr)
            db.session.rollback()
            print("Database session rolled back due to error during reset.", file=sys.stderr)
            # sys.exit("Failed to reset database. Exiting.")
    print("Database reset process finished.", file=sys.stderr)
# !!! END OF DATABASE RESET LOGIC !!!


# --- Database Model Definition (Define models AFTER reset logic) ---
class Task(db.Model):
    __tablename__ = 'task' # Good practice to explicitly name the table
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(200), nullable=False)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    # --->>> ADDED category column <<<---
    category = db.Column(db.String(100), nullable=False, default='default', server_default='default')
    # created_at = db.Column(db.DateTime, default=datetime.utcnow) # Keep commented for now

    def __repr__(self):
        # --->>> UPDATED representation <<<---
        return f'<Task {self.id}: {self.content} [Cat: {self.category}] (Completed: {self.completed})>'
# --- End Model Definition ---


# === ROUTES ===

@app.route('/')
def index():
    # This route primarily renders the HTML template.
    # It doesn't necessarily need category data unless your index.html uses it.
    try:
        all_tasks = Task.query.order_by(Task.id).all()
        print(f"Rendering index with {len(all_tasks)} tasks.", file=sys.stderr) # Add log
    except Exception as e:
        print(f"Error querying tasks for index: {e}", file=sys.stderr)
        if "relation \"task\" does not exist" in str(e) or "UndefinedColumn" in str(e):
             print("Task table likely doesn't exist or has wrong schema.", file=sys.stderr)
             all_tasks = []
        else:
            all_tasks = []
            print(f"Unhandled database error during index query: {e}", file=sys.stderr)
    return render_template('index.html', tasks=all_tasks)

@app.route('/tasks', methods=['GET'])
def get_tasks():
    """Returns all tasks as JSON, including categories."""
    try:
        all_tasks = Task.query.order_by(Task.id).all()
        # Convert task objects to dictionaries for JSON serialization
        tasks_list = [
            {
              "id": task.id,
              "content": task.content,
              "completed": task.completed,
              # --->>> ADDED category field <<<---
              "category": task.category  # Send the category for each task
            }
            for task in all_tasks
        ]
        print(f"API: Returning {len(tasks_list)} tasks with categories.", file=sys.stderr)
        return jsonify(tasks_list) # Use jsonify!
    except Exception as e:
        print(f"Error fetching tasks for API: {e}", file=sys.stderr)
        if "relation \"task\" does not exist" in str(e) or "UndefinedColumn" in str(e):
             print("API: Task table likely doesn't exist or has wrong schema.", file=sys.stderr)
             return jsonify({"error": "Database table not found or schema mismatch"}), 500 # Internal Server Error
        return jsonify({"error": "Internal server error fetching tasks"}), 500

# --->>> ADDED THIS ENTIRE NEW ROUTE FOR CATEGORIES <<<---
@app.route('/categories', methods=['GET'])
def get_categories():
    """Returns a list of unique category names."""
    try:
        # Query the database for distinct category values from the Task table
        unique_categories_query = db.session.query(Task.category).distinct().all()

        # Extract the category name (the first item) from each tuple,
        # making sure it's not None or an empty string.
        categories = [cat[0] for cat in unique_categories_query if cat[0] is not None and cat[0] != '']

        # Ensure 'default' is always in the list, maybe add it first
        if 'default' not in categories:
            categories.insert(0, 'default')

        print(f"API: Returning categories: {categories}", file=sys.stderr)
        return jsonify(categories), 200 # Return the list as JSON

    except Exception as e:
        print(f"Error fetching categories for API: {e}", file=sys.stderr)
        return jsonify({"error": "Internal server error fetching categories"}), 500
# --->>> END OF NEW /categories ROUTE <<<---

@app.route('/add', methods=['POST'])
def add_task():
    try:
        if not request.is_json:
            print("Error adding task: Request not JSON", file=sys.stderr)
            return jsonify({"success": False, "error": "Request must be JSON"}), 400

        data = request.get_json()
        task_content = data.get('content')
        # --->>> ADDED: Get category from request, default to 'default' <<<---
        task_category = data.get('category', 'default').strip() # Use .strip() to remove leading/trailing whitespace
        if not task_category: # If category is empty after stripping, use 'default'
             task_category = 'default'

        if not task_content:
            print("Error adding task: Content empty", file=sys.stderr)
            return jsonify({"success": False, "error": "Task content cannot be empty"}), 400

        # --->>> MODIFIED: Pass the category when creating <<<---
        new_task_obj = Task(content=task_content, category=task_category)
        db.session.add(new_task_obj)
        db.session.commit()
        # --->>> UPDATED log <<<---
        print(f"Added task ID: {new_task_obj.id}, Content: {new_task_obj.content}, Category: {new_task_obj.category}", file=sys.stderr)

        # --->>> UPDATED: Include category in the response <<<---
        return jsonify({
            "success": True,
            "task": {
                "id": new_task_obj.id,
                "content": new_task_obj.content,
                "completed": new_task_obj.completed,
                "category": new_task_obj.category # Add category here!
            }
        }), 201

    except Exception as e:
        db.session.rollback() # Rollback transaction on error
        print(f"Error adding task: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/ask-ai', methods=['POST'])
def ask_ai():
    """Handles requests to get AI details for a task."""
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key is None:
            print("Error: GOOGLE_API_KEY env var not set.", file=sys.stderr)
            return jsonify({"error": "Server configuration error: Missing API key."}), 500

        data = request.get_json()
        task_text = data.get('task_text')
        if not task_text:
            return jsonify({"error": "Missing task text in request."}), 400

        print(f"Asking AI about task: {task_text[:50]}...", file=sys.stderr)
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"Please provide more details, break down into sub-steps, or give tips for completing the following task:\n\nTask: \"{task_text}\""
        response = model.generate_content(prompt)
        print(f"AI Response received for task: {task_text[:50]}...", file=sys.stderr)
        return jsonify({"details": response.text})

    except Exception as e:
        print(f"Error calling Gemini API in ask_ai: {e}", file=sys.stderr)
        error_message = f"An error occurred contacting AI: {e}"
        return jsonify({"error": error_message}), 500

@app.route('/motivate-me', methods=['POST'])
def motivate_me():
    """Generates a motivational message using Gemini."""
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key is None:
            print("Error: GOOGLE_API_KEY env var not set.", file=sys.stderr)
            return jsonify({"error": "Server configuration error: Missing API key."}), 500

        print("Requesting motivation from AI...", file=sys.stderr)
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = (
            "Generate a short, punchy, and slightly quirky motivational message "
            "for someone using a to-do list app. Make it encouraging but maybe a little funny or unexpected. "
            "Keep it under 50 words."
        )
        response = model.generate_content(prompt)
        print("Motivation received from AI.", file=sys.stderr)
        return jsonify({"motivation": response.text})

    except Exception as e:
        print(f"Error calling Gemini API in motivate_me: {e}", file=sys.stderr)
        error_message = f"An error occurred getting motivation: {e}"
        return jsonify({"error": error_message}), 500

@app.route('/complete/<int:task_id>', methods=['POST'])
def complete_task(task_id):
    """Toggles the completion status of a task."""
    try:
        task = Task.query.get_or_404(task_id)
        print(f"Toggling completion for task ID: {task_id}. Current status: {task.completed}", file=sys.stderr)

        task.completed = not task.completed
        db.session.commit()
        print(f"Task ID: {task_id} completion status updated to: {task.completed}", file=sys.stderr)

        return jsonify({"success": True, "completed_status": task.completed}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error completing task {task_id}: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/delete/<int:task_id>', methods=['POST'])
def delete_task(task_id):
    """Deletes a task by its ID."""
    try:
        task_to_delete = Task.query.get_or_404(task_id)
        db.session.delete(task_to_delete)
        db.session.commit()

        print(f"Task with ID {task_id} deleted successfully.", file=sys.stderr)
        return jsonify({'success': True, 'message': 'Task deleted successfully'})

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting task {task_id}: {e}", file=sys.stderr)
        return jsonify({'success': False, 'error': 'Failed to delete task due to a server error.'}), 500

# --- Create Database Tables (Ensures tables exist on normal startup) ---
# This block runs AFTER the conditional reset and AFTER model definition
with app.app_context():
    print("Final check: Ensuring database tables exist...", file=sys.stderr)
    try:
        db.create_all()
        print("Database tables checked/created.", file=sys.stderr)
    except Exception as e:
        print(f"Error during final db.create_all(): {e}", file=sys.stderr)
        # sys.exit("Could not ensure database tables exist. Exiting.")
# --- End Create Tables ---

# --- Main Run Block ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"--- Starting Flask development server on port {port} ---", file=sys.stderr)
    # Set debug=False for production deployment
    app.run(debug=False, host='0.0.0.0', port=port)

print("--- Python script finished initial setup ---", file=sys.stderr)