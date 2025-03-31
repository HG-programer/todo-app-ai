import os
print("---Python script starting---")
from flask import Flask, render_template, request, redirect, url_for, jsonify
import sys
import google.generativeai as genai

app = Flask(__name__)
# In-memory list to store tasks (for simplicity)
tasks = [] # <--- Your global tasks list

@app.route('/')
def index():
    # Pass the current list of tasks to the template
    return render_template('index.html', tasks=tasks) # <-- Make sure tasks=tasks is here

# --- Add this new function ---
@app.route('/add', methods=['POST'])
def add_task():
    try:
        # Check if the request contains JSON data
        if not request.is_json:
            return jsonify({"success": False, "error": "Request must be JSON"}), 400 # Bad Request

        data = request.get_json()
        task = data.get('task') # Get task from JSON key 'task'

        if not task: # Basic validation
            return jsonify({"success": False, "error": "Task content cannot be empty"}), 400

        tasks.append(task) # Add to your list (or database later)

        # Return success response with the added task
        return jsonify({"success": True, "task": task}), 201 # 201 Created

    except Exception as e:
        print(f"Error adding task: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": "Internal server error"}), 500
# --- End of new function ---
# <<< PASTE THIS CODE BLOCK AFTER add_task() FUNCTION >>>

@app.route('/ask-ai', methods=['POST'])
def ask_ai():
    """Handles requests to get AI details for a task."""
    try:
        # --- 1. Get API Key (MUST be available inside Docker) ---
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key is None:
            print("Error: GOOGLE_API_KEY environment variable not set inside container.", file=sys.stderr)
            return jsonify({"error": "Server configuration error: Missing API key."}), 500

        # --- 2. Get Task Text from Request ---
        data = request.get_json()
        task_text = data.get('task_text')
        if not task_text:
            return jsonify({"error": "Missing task text in request."}), 400

        # --- 3. Configure Gemini and Generate Content ---
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash') # Or gemini-pro

        prompt = f"Please provide more details, break down into sub-steps, or give tips for completing the following task:\n\nTask: \"{task_text}\""

        response = model.generate_content(prompt)

        # --- 4. Return Response ---
        return jsonify({"details": response.text})

    except Exception as e:
        print(f"Error calling Gemini API: {e}", file=sys.stderr)
        # Try to get more specific error details if possible
        error_message = f"An error occurred while contacting the AI: {e}"
        # Check for specific Gemini API error types if needed
        # Example: if hasattr(e, 'message'): error_message = e.message
        return jsonify({"error": error_message}), 500
# <<< PASTE THIS CODE BLOCK (e.g., after ask_ai() function) >>>

@app.route('/motivate-me', methods=['POST'])
def motivate_me():
    """Generates a motivational message using Gemini."""
    try:
        # --- 1. Get API Key ---
        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key is None:
            print("Error: GOOGLE_API_KEY environment variable not set inside container.", file=sys.stderr)
            return jsonify({"error": "Server configuration error: Missing API key."}), 500

        # --- 2. Configure Gemini ---
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash') # Or gemini-pro

        # --- 3. Craft a Fun Prompt ---
        # You can get creative here! Add context if needed later.
        prompt = (
            "Generate a short, punchy, and slightly quirky motivational message "
            "for someone using a to-do list app. Make it encouraging but maybe a little funny or unexpected. "
            "Keep it under 50 words."
            # Example alternative: "Give me a short, slightly sassy motivational quote about getting things done."
            # Example alternative: "Generate a supportive message for someone feeling overwhelmed by their tasks."
        )

        # --- 4. Generate Content ---
        response = model.generate_content(prompt)

        # --- 5. Return Response ---
        # Ensure the key here ('motivation') matches what the JavaScript expects
        return jsonify({"motivation": response.text})

    except Exception as e:
        print(f"Error calling Gemini API for motivation: {e}", file=sys.stderr)
        error_message = f"An error occurred while getting motivation: {e}"
        return jsonify({"error": error_message}), 500

# <<< END OF PASTE BLOCK >>>
# <<< END OF PASTE BLOCK >>>
if __name__ == '_main_':
    # Make it accessible on the network (important for Docker)
    # The host and port here are for running directly with python app.py
    # flask run uses different defaults but reads FLASK_RUN_HOST etc. if set
    port = int(os.environ.get('PORT', 5000)) # Get the port from the environment variable or default to 5000
    app.run(debug = True,host='0.0.0.0', port=port)