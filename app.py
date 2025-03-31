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


# Your other routes follow...
# @app.route('/')
# def index():
#    ...
# !!! IMPORTANT: DATABASE RESET LOGIC !!!
# Check for a reset flag environment variable BEFORE defining models
if os.environ.get('RESET_DB') == 'TRUE':
    print("RESET_DB environment variable set to TRUE. Dropping and recreating tables.", file=sys.stderr)
    with app.app_context():
        try:
            # Drop all tables known to SQLAlchemy in this app context
            db.drop_all()
            print("Tables dropped successfully.", file=sys.stderr)
            # Recreate tables based on current models (defined below)
            db.create_all()
            print("Tables recreated successfully based on models.", file=sys.stderr) # Confirming after create_all
            # ===>>> ADDED COMMIT AND ROLLBACK <<<===
            db.session.commit() # Force commit the changes from drop/create
            print("Database session committed after reset.", file=sys.stderr)
            # ===>>> END OF ADDED COMMIT/ROLLBACK <<<===
        except Exception as e:
            print(f"Error during DB reset (drop/create): {e}", file=sys.stderr)
            # ===>>> ADDED ROLLBACK ON ERROR <<<===
            db.session.rollback() # Rollback if any error occurred
            print("Database session rolled back due to error during reset.", file=sys.stderr)
            # ===>>> END OF ADDED ROLLBACK <<<===
            # Decide if you want the app to continue or exit if reset fails
            # sys.exit("Failed to reset database. Exiting.")
    print("Database reset process finished.", file=sys.stderr)
# !!! END OF DATABASE RESET LOGIC !!!


# --- Database Model Definition (Define models AFTER reset logic) ---
class Task(db.Model):
    __tablename__ = 'task' # Good practice to explicitly name the table
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(200), nullable=False)
    # Ensure completed column is defined correctly
    completed = db.Column(db.Boolean, nullable=False, default=False)
    # created_at = db.Column(db.DateTime, default=datetime.utcnow) # Keep commented for now

    def __repr__(self):
        # Optionally add completed status to the representation
        return f'<Task {self.id}: {self.content} (Completed: {self.completed})>'
# --- End Model Definition ---


# === ROUTES ===

@app.route('/')
def index():
    try:
        # Order by ID or another field like created_at if you add it
        all_tasks = Task.query.order_by(Task.id).all()
        print(f"Found {len(all_tasks)} tasks.", file=sys.stderr) # Add log
    except Exception as e:
        print(f"Error querying tasks: {e}", file=sys.stderr)
        # Check if the error is because the table doesn't exist (common on first run or after drop)
        # This specific check might vary depending on the DB driver
        if "relation \"task\" does not exist" in str(e) or "UndefinedColumn" in str(e): # Check for UndefinedColumn too
             print("Task table likely doesn't exist or has wrong schema.", file=sys.stderr)
             all_tasks = [] # Return empty list if table isn't there or wrong schema
        else:
            # Handle other potential DB errors
            all_tasks = [] # Or handle differently
            print(f"Unhandled database error during query: {e}", file=sys.stderr)
        # Optionally, flash a message to the user
    return render_template('index.html', tasks=all_tasks)


@app.route('/add', methods=['POST'])
def add_task():
    try:
        if not request.is_json:
            print("Error adding task: Request not JSON", file=sys.stderr)
            return jsonify({"success": False, "error": "Request must be JSON"}), 400

        data = request.get_json()
        task_content = data.get('content') # Match the key sent by JavaScript ('content')

        if not task_content:
            print("Error adding task: Content empty", file=sys.stderr)
            return jsonify({"success": False, "error": "Task content cannot be empty"}), 400

        # Create new task, default 'completed' is False
        new_task_obj = Task(content=task_content)
        db.session.add(new_task_obj)
        db.session.commit()
        print(f"Added task ID: {new_task_obj.id}, Content: {new_task_obj.content}", file=sys.stderr) # Add log

        # Return the created task details (including ID) for potential frontend use
        return jsonify({
            "success": True,
            "task": {
                "id": new_task_obj.id,
                "content": new_task_obj.content,
                "completed": new_task_obj.completed
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

        print(f"Asking AI about task: {task_text[:50]}...", file=sys.stderr) # Log request
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"Please provide more details, break down into sub-steps, or give tips for completing the following task:\n\nTask: \"{task_text}\""
        response = model.generate_content(prompt)
        print(f"AI Response received for task: {task_text[:50]}...", file=sys.stderr) # Log response
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

        print("Requesting motivation from AI...", file=sys.stderr) # Log request
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = (
            "Generate a short, punchy, and slightly quirky motivational message "
            "for someone using a to-do list app. Make it encouraging but maybe a little funny or unexpected. "
            "Keep it under 50 words."
        )
        response = model.generate_content(prompt)
        print("Motivation received from AI.", file=sys.stderr) # Log response
        return jsonify({"motivation": response.text})

    except Exception as e:
        print(f"Error calling Gemini API in motivate_me: {e}", file=sys.stderr)
        error_message = f"An error occurred getting motivation: {e}"
        return jsonify({"error": error_message}), 500


@app.route('/complete/<int:task_id>', methods=['POST'])
def complete_task(task_id):
    """Toggles the completion status of a task."""
    try:
        # Find the task by its ID, return 404 if not found
        task = Task.query.get_or_404(task_id)
        print(f"Toggling completion for task ID: {task_id}. Current status: {task.completed}", file=sys.stderr) # Log

        # Toggle the completed status
        task.completed = not task.completed

        # Commit the change to the database
        db.session.commit()
        print(f"Task ID: {task_id} completion status updated to: {task.completed}", file=sys.stderr) # Log

        # Return a success response, including the new status
        return jsonify({"success": True, "completed_status": task.completed}), 200

    except Exception as e:
        db.session.rollback() # Rollback on error
        print(f"Error completing task {task_id}: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/delete/<int:task_id>', methods=['POST'])
def delete_task(task_id):
    """Deletes a task by its ID."""
    try:
        # Find the task by its ID
        task_to_delete = Task.query.get_or_404(task_id)

        # Delete the task from the database session
        db.session.delete(task_to_delete)

        # Commit the changes to the database
        db.session.commit()

        print(f"Task with ID {task_id} deleted successfully.") # Server log
        return jsonify({'success': True, 'message': 'Task deleted successfully'})

    except Exception as e:
        # Rollback in case of error during deletion
        db.session.rollback()
        print(f"Error deleting task {task_id}: {e}") # Server log
        # Return a generic server error message
        return jsonify({'success': False, 'error': 'Failed to delete task due to a server error.'}), 500

# Make sure Task model and db are defined before this route
# Make sure jsonify is imported from flask

# --- Create Database Tables (Ensures tables exist on normal startup) ---
# This block runs AFTER the conditional reset and AFTER model definition
with app.app_context():
    print("Final check: Ensuring database tables exist...", file=sys.stderr)
    try:
        # This will create tables if they don't exist.
        # If RESET_DB was TRUE, they were already created, so this does nothing.
        # If RESET_DB was FALSE/unset, this creates them if they're missing.
        db.create_all()
        print("Database tables checked/created.", file=sys.stderr)
    except Exception as e:
        # Catch specific errors if possible, e.g., connection errors
        print(f"Error during final db.create_all(): {e}", file=sys.stderr)
        # Decide if the app should exit if it can't ensure tables exist
        # sys.exit("Could not ensure database tables exist. Exiting.")
# --- End Create Tables ---


# --- Main Run Block ---
if __name__ == '__main__': # Corrected typo here from your original paste
    # Use Gunicorn's port binding in Render, but keep this for local testing
    port = int(os.environ.get('PORT', 5001)) # Changed default port just in case 5000 is busy
    print(f"--- Starting Flask development server on port {port} ---", file=sys.stderr)
    # Set debug=False for deployment; Render uses Dockerfile CMD, not this block usually.
    app.run(debug=False, host='0.0.0.0', port=port)

print("--- Python script finished initial setup ---", file=sys.stderr) # Add final log