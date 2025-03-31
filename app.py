import os
import sys
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
import google.generativeai as genai

print("---Python script starting---")

app = Flask(__name__)

# --- Database Configuration ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set.", file=sys.stderr)
    # sys.exit("Database URL not found. Exiting.") # Optional: Exit if critical

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# --- End Database Configuration ---

# --- Initialize SQLAlchemy AFTER configuration ---
db = SQLAlchemy(app)
# --- End Initialization ---

# --- Database Model Definition (ONLY ONCE) ---
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(200), nullable=False)
    # completed = db.Column(db.Boolean, default=False) # Future field
    # created_at = db.Column(db.DateTime, default=datetime.utcnow) # Future field (need import datetime)

    def __repr__(self):
        return f'<Task {self.id}: {self.content}>'
# --- End Model Definition ---

# tasks = [] # DELETE OR COMMENT OUT THIS LINE


# === ROUTES ===

@app.route('/')
def index():
    try:
        all_tasks = Task.query.order_by(Task.id).all()
    except Exception as e:
        # Handle case where DB might not be connected yet or table doesn't exist
        # This might happen on the very first run before db.create_all() fully finishes
        # or if DATABASE_URL is missing.
        print(f"Error querying tasks: {e}", file=sys.stderr)
        all_tasks = [] # Show an empty list if DB query fails
        # Optionally, flash a message to the user
    return render_template('index.html', tasks=all_tasks)


@app.route('/add', methods=['POST'])
def add_task():
    try:
        if not request.is_json:
            return jsonify({"success": False, "error": "Request must be JSON"}), 400

        data = request.get_json()
        task_content = data.get('task') # Use a different variable name like task_content

        if not task_content:
            return jsonify({"success": False, "error": "Task content cannot be empty"}), 400

        # --- Database logic correctly placed ---
        new_task_obj = Task(content=task_content)
        db.session.add(new_task_obj)
        db.session.commit()
        # --- End database logic ---

        return jsonify({"success": True, "task": new_task_obj.content}), 201

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


# --- Create Database Tables (Add this block!) ---
with app.app_context():
    print("Creating database tables if they don't exist...", file=sys.stderr)
    try:
        db.create_all()
        print("Database tables checked/created.", file=sys.stderr)
    except Exception as e:
        print(f"Error creating database tables: {e}", file=sys.stderr)
        # You might want to handle this more gracefully depending on the error
# --- End Create Tables ---


# --- Main Run Block ---
if __name__ == '__main__': # Corrected typo here
    port = int(os.environ.get('PORT', 5000))
    # Note: Setting debug=False is better for production/deployment stability
    # Render might override this, but it's good practice.
    app.run(debug=False, host='0.0.0.0', port=port)