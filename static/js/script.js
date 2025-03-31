document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Original Ask AI Button Setup ---
    const initialAiButtons = document.querySelectorAll('.ask-ai-btn');
    initialAiButtons.forEach(button => {
        attachAskAiListener(button); // Use the new function
    });
    // --- End of Section 1 ---


    // --- SECTION 2: New Code for Task Form ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList');

    // Check if the form element actually exists before adding listener
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the default form submission (page reload)

            const taskText = taskInput.value.trim(); // Get text from input and remove whitespace

            if (taskText === "") {
                return; // Don't add empty tasks
            }

            const submitButton = addTaskForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';

            try {
                // === FIXED: Use direct path instead of url_for ===
                const response = await fetch("/add", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ task: taskText }) // Send task text as JSON
                });
                // =============================================

                const result = await response.json();

                if (response.status === 201 && result.success) {
                    addNewTaskToList(result.task); // Call helper function (defined below)
                    taskInput.value = '';
                    const noTasksMsg = document.getElementById('noTasksMessage');
                    if (noTasksMsg) {
                        noTasksMsg.remove();
                    }
                } else {
                    alert(`Error adding task: ${result.error || 'Unknown server error'}`); // Keep alert for now
                }

            } catch (error) {
                console.error('Network or fetch error:', error);
                alert('Failed to add task. Check the console for details.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Add Task';
            }
        });
    } else {
        console.error("Add Task form not found!"); // Log error if form is missing
    }
    // --- End of Section 2 ---


    // --- SECTION 3: Helper Functions ---
    // --- Helper function to create and add the new list item ---
    function addNewTaskToList(taskText) {
        // Ensure taskList element exists
        if (!taskList) {
             console.error("Task list element not found!");
             return;
        }
        const li = document.createElement('li');
        li.className = 'list-group-item task-item';

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = taskText;

        const buttonDiv = document.createElement('div');

        const aiButton = document.createElement('button');
        aiButton.className = 'ask-ai-btn btn btn-info btn-sm';
        aiButton.textContent = 'Ask AI';
        aiButton.dataset.taskText = taskText;

        attachAskAiListener(aiButton); // Attach listener to the NEW button

        buttonDiv.appendChild(aiButton);
        li.appendChild(span);
        li.appendChild(buttonDiv);
        taskList.appendChild(li);
    }

    // --- Function to attach listener ---
    function attachAskAiListener(button) {
        button.addEventListener('click', async () => {
            const taskText = button.dataset.taskText;
            button.disabled = true;
            button.textContent = 'Asking AI...';

            try {
                const response = await fetch('/ask-ai', { // Direct path is correct here
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ task_text: taskText })
                });
                const result = await response.json();

                const modalTitleSpan = document.getElementById('modalTaskTitle');
                const modalBody = document.getElementById('aiResponseModalBody');
                const aiModalElement = document.getElementById('aiResponseModal');

                // Check if modal elements exist before proceeding
                if (!modalTitleSpan || !modalBody || !aiModalElement) {
                    console.error("Modal elements not found!");
                    alert("UI error: Cannot display AI response."); // Fallback alert
                    return; // Stop if modal isn't set up right
                }

                // Ensure bootstrap object is available before using it
                if (typeof bootstrap !== 'undefined') {
                     const aiModal = new bootstrap.Modal(aiModalElement);
                    if (response.ok) {
                        modalTitleSpan.textContent = taskText;
                        modalBody.innerText = result.details;
                        aiModal.show();
                    } else {
                        modalTitleSpan.textContent = "Error";
                        modalBody.innerText = `Error fetching AI details: ${result.error || 'Unknown server error'}`;
                        aiModal.show();
                    }
                } else {
                     console.error("Bootstrap JavaScript not loaded!");
                     alert("Error: UI Component failed to load."); // Fallback alert
                }

            } catch (error) {
                console.error('Network or fetch error:', error);
                alert('Failed to contact the AI service. Check the console for details.');
            } finally {
                button.disabled = false;
                button.textContent = 'Ask AI';
            }
        });
    }
    // --- End of Section 3 ---
    // --- SECTION 4: New Code for Motivate Me Button ---

    // Select all "Motivate Me" buttons (even ones added later) using event delegation
    // We listen on the taskList instead of attaching to each button directly
    const taskListElement = document.getElementById('taskList'); // Use the task list ID

    if (taskListElement) {
        taskListElement.addEventListener('click', async (event) => {
            // Check if the clicked element IS a motivate-me button
            if (event.target && event.target.classList.contains('motivate-me-btn')) {
                const button = event.target; // The button that was clicked
                // Optional: Could get task context if needed later, but not now

                button.disabled = true;
                button.textContent = 'Motivating...';

                try {
                    // Call a NEW Flask endpoint for motivation
                    const response = await fetch('/motivate-me', {
                        method: 'POST', // Using POST, although GET could work too
                        headers: {
                            'Content-Type': 'application/json',
                        }
                        // No body needed for a generic motivation request
                    });
                    const result = await response.json();

                    // --- Display response in the SAME modal ---
                    const modalTitleSpan = document.getElementById('modalTaskTitle');
                    const modalBody = document.getElementById('aiResponseModalBody');
                    const aiModalElement = document.getElementById('aiResponseModal');

                    if (!modalTitleSpan || !modalBody || !aiModalElement) {
                        console.error("Modal elements not found!");
                        alert("UI error: Cannot display AI response.");
                        return; // Stop if modal isn't set up right
                    }

                    if (typeof bootstrap !== 'undefined') {
                        const aiModal = new bootstrap.Modal(aiModalElement);
                        if (response.ok) {
                            modalTitleSpan.textContent = "A Dose of Motivation!"; // Generic Title
                            modalBody.innerText = result.motivation; // Expecting 'motivation' key
                            aiModal.show();
                        } else {
                            modalTitleSpan.textContent = "Error";
                            modalBody.innerText = `Error fetching motivation: ${result.error || 'Unknown server error'}`;
                            aiModal.show();
                        }
                    } else {
                        console.error("Bootstrap JavaScript not loaded!");
                        alert("Error: UI Component failed to load.");
                    }
                    // --- End of modal display ---

                } catch (error) {
                    console.error('Network or fetch error (Motivate Me):', error);
                    alert('Failed to contact the AI motivation service. Check console.');
                } finally {
                    button.disabled = false;
                    button.textContent = 'Motivate Me!';
                }
            }
        });
    } else {
        console.error("Task list element not found for motivation listener!");
    }
      // --- End of Section 4 ---
          // --- SECTION 6: Task Completion Toggle Logic ---

    // Use the existing taskListElement reference from Motivate Me section, or get it again
    // const taskListElement = document.getElementById('taskList'); // Already defined above

    if (taskListElement) {
        taskListElement.addEventListener('change', async (event) => {
            // Check if the changed element IS a task-checkbox
            if (event.target && event.target.classList.contains('task-checkbox')) {
                const checkbox = event.target;
                const taskId = checkbox.dataset.taskId; // Get task ID from data attribute
                const isCompleted = checkbox.checked; // Get the new checked state
                const listItem = checkbox.closest('.task-item'); // Find the parent <li> element

                // Optional: Optimistic UI update (update UI immediately)
                // listItem.classList.toggle('task-completed', isCompleted);

                try {
                    // Call the NEW Flask endpoint to update the backend
                    const response = await fetch(`/complete/${taskId}`, {
                        method: 'POST', // Matches the method defined in Flask route
                        headers: {
                            'Content-Type': 'application/json',
                            // Add CSRF token header here if you implement CSRF protection later
                        }
                        // No body needed, the ID is in the URL and the action is implicit
                    });

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        // --- Rollback UI on error ---
                        console.error('Error updating task status:', result.error || 'Unknown server error');
                        // Revert checkbox state
                        checkbox.checked = !isCompleted;
                        // Revert styling class (if using optimistic update)
                        // listItem.classList.toggle('task-completed', !isCompleted);
                        alert(`Error updating task: ${result.error || 'Server error'}`);
                    } else {
                        // --- Confirm UI update on success ---
                        // Update the class on the list item based on the *confirmed* status from server
                        listItem.classList.toggle('task-completed', result.completed_status);
                        // Ensure checkbox matches confirmed status (it usually will, but good practice)
                        checkbox.checked = result.completed_status;
                        console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
                    }

                } catch (error) {
                    // --- Rollback UI on fetch error ---
                    console.error('Network or fetch error (Complete Task):', error);
                    checkbox.checked = !isCompleted; // Revert checkbox state
                    // listItem.classList.toggle('task-completed', !isCompleted); // Revert styling class
                    alert('Failed to update task status. Check network connection.');
                }
            }
        });
    } else {
        console.error("Task list element not found for completion listener!");
    }

    // --- End Section 6 ---
    // --- SECTION 5: Theme Toggling Logic ---
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const currentStoredTheme = localStorage.getItem('theme');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    // Function to apply the theme to the <html> element using data-bs-theme attribute
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
             // Optional: Change button text/icon for dark mode
             if(themeToggleButton) themeToggleButton.textContent = "Toggle Theme ☀️";
        } else {
            document.documentElement.removeAttribute('data-bs-theme');
             // Optional: Change button text/icon for light mode
             if(themeToggleButton) themeToggleButton.textContent = "Toggle Theme 🌓";
        }
    };

    // Determine and apply the initial theme on page load
    let initialTheme = 'light'; // Default to light
    if (currentStoredTheme) {
        initialTheme = currentStoredTheme; // Use stored preference if exists
    } else if (prefersDarkScheme.matches) {
        initialTheme = 'dark'; // Use system preference if no stored preference
    }
    applyTheme(initialTheme); // Apply the determined theme

    // Add click listener to the toggle button
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            // Determine the new theme by checking the current attribute
            let newTheme = document.documentElement.hasAttribute('data-bs-theme') ? 'light' : 'dark';
            applyTheme(newTheme); // Apply the new theme
            localStorage.setItem('theme', newTheme); // Save the new preference
        });
    } else {
        console.error("Theme toggle button not found!");
    }
    // --- END SECTION 5 ---

}); // End of DOMContentLoaded listener
  
