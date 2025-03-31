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

# !!! IMPORTANT: DATABASE RESET LOGIC (ADD THIS) !!!
# Check for a reset flag environment variable BEFORE defining models
if os.environ.get('RESET_DB') == 'TRUE':
    print("RESET_DB environment variable set to TRUE. Dropping and recreating tables.", file=sys.stderr)
    with app.app_context():
        try:
            # Drop all tables known to SQLAlchemy in this app context
            db.drop_all()
            print("Tables dropped successfully.", file=sys.stderr)
            # Recreate tables based on current models (defined below)
            # Note: create_all needs the models defined, but drop_all does not necessarily.
            # However, it's cleaner to keep create_all here too.
            db.create_all()
            print("Tables recreated successfully based on models below.", file=sys.stderr)
        except Exception as e:
            print(f"Error during DB reset (drop/create): {e}", file=sys.stderr)
            # Decide if you want the app to continue or exit if reset fails
            # sys.exit("Failed to reset database. Exiting.")
    print("Database reset process finished.", file=sys.stderr)
# !!! END OF DATABASE RESET LOGIC !!!


# --- Database Model Definition (Define models AFTER reset logic) ---
class Task(db.Model):
    __tablename__ = 'task' # Good practice to explicitly name the table
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(200), nullable=False)
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
    except Exception as e:
        print(f"Error querying tasks: {e}", file=sys.stderr)
        # Check if the error is because the table doesn't exist (common on first run or after drop)
        # This specific check might vary depending on the DB driver
        if "relation \"task\" does not exist" in str(e):
             print("Task table likely doesn't exist yet.", file=sys.stderr)
             all_tasks = [] # Return empty list if table isn't there
        else:
            # Handle other potential DB errors
            all_tasks = [] # Or handle differently
        # Optionally, flash a message to the user
    return render_template('index.html', tasks=all_tasks)


@app.route('/add', methods=['POST'])
def add_task():
    try:
        if not request.is_json:
            return jsonify({"success": False, "error": "Request must be JSON"}), 400

        data = request.get_json()
        task_content = data.get('content') # Match the key sent by JavaScript ('content')

        if not task_content:
            return jsonify({"success": False, "error": "Task content cannot be empty"}), 400

        # Create new task, default 'completed' is False
        new_task_obj = Task(content=task_content)
        db.session.add(new_task_obj)
        db.session.commit()

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

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"Please provide more details, break down into sub-steps, or give tips for completing the following task:\n\nTask: \"{task_text}\""
        response = model.generate_content(prompt)
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

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = (
            "Generate a short, punchy, and slightly quirky motivational message "
            "for someone using a to-do list app. Make it encouraging but maybe a little funny or unexpected. "
            "Keep it under 50 words."
        )
        response = model.generate_content(prompt)
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

        # Toggle the completed status
        task.completed = not task.completed

        # Commit the change to the database
        db.session.commit()

        # Return a success response, including the new status
        return jsonify({"success": True, "completed_status": task.completed}), 200

    except Exception as e:
        db.session.rollback() # Rollback on error
        print(f"Error completing task {task_id}: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": "Internal server error"}), 500


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
    print(f"--- Starting Flask server on port {port} ---", file=sys.stderr)
    # Set debug=False for deployment
    app.run(debug=False, host='0.0.0.0', port=port)