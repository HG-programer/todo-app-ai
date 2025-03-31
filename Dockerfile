# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# Ensure gunicorn is in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

# Define environment variable (FLASK_APP is often not needed by gunicorn)
# ENV FLASK_APP=app.py # Not strictly needed by Gunicorn usually

# EXPOSE is informational; Render uses $PORT for binding.

# Run app.py using Gunicorn when the container launches
# Gunicorn will listen on the port specified by the PORT environment variable (provided by Render)
# Use /bin/sh -c to enable shell variable expansion for $PORT
CMD ["/bin/sh", "-c", "gunicorn --bind 0.0.0.0:$PORT app:app"]