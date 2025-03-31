document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal'); // Modal container
    const modalTitleSpan = document.getElementById('modalTaskTitle'); // Modal title element
    const modalBody = document.getElementById('aiResponseModalBody'); // Modal body element
    const noTasksMsg = document.getElementById('noTasksMessage'); // Message shown when list is empty
    // --- End Section 1 ---


    // --- SECTION 2: Add Task Form Handling ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const taskText = taskInput.value.trim();
            if (taskText === "") {
                alert("Task content cannot be empty.");
                return;
            }

            const submitButton = addTaskForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';

            try {
                const response = await fetch("/add", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: taskText }) // Backend expects 'content'
                });

                const result = await response.json();

                if (response.status === 201 && result.success) {
                    addNewTaskToList(result.task); // result.task contains {id, content, completed}
                    taskInput.value = ''; // Clear input field
                    // The 'no tasks' message is handled inside addNewTaskToList now
                } else {
                    console.error("Error adding task:", result.error || `Status: ${response.status}`);
                    alert(`Error adding task: ${result.error || 'Unknown server error'}`);
                }

            } catch (error) {
                // This catches network errors or issues with fetch/await itself
                console.error('Network or fetch error adding task:', error);
                // Display the JavaScript error caught in the alert
                alert(`Failed to add task. Error: ${error.message}. Check the console for details.`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Add Task';
            }
        });
    } else {
        console.error("Add Task form (#addTaskForm) not found!");
    }
    // --- End Section 2 ---


    // --- SECTION 3: Task List Event Delegation ---
    if (taskList) {
        // --- CLICK Listener (for Buttons) ---
        taskList.addEventListener('click', async (event) => {
            const target = event.target;
            const button = target.closest('button'); // Get the button element clicked or its parent

            if (!button) return; // Exit if the click wasn't on or inside a button

            // Handle 'Ask AI' button clicks
            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText;
                handleAskAiClick(button, taskText);
            }
            // Handle 'Motivate Me' button clicks
            else if (button.classList.contains('motivate-me-btn')) {
                handleMotivateMeClick(button);
            }
            // Handle 'Delete' button clicks <<--- CORRECT PLACE FOR DELETE LISTENER
            else if (button.classList.contains('delete-btn')) {
                const taskId = button.dataset.taskId;
                handleDeleteClick(button, taskId);
            }
        });

        // --- CHANGE Listener (specifically for Checkboxes) ---
        taskList.addEventListener('change', async (event) => {
             const target = event.target;
             // Handle Checkbox changes
            if (target.classList.contains('task-checkbox') && target.type === 'checkbox') {
                const checkbox = target;
                const taskId = checkbox.dataset.taskId;
                handleCheckboxChange(checkbox, taskId);
            }
        });

    } else {
        console.error("Task list (#taskList) element not found!");
    }
    // --- End Section 3 ---


    // --- SECTION 4: Helper Function to Add New Task LI Element ---
    function addNewTaskToList(task) { // Expects {id, content, completed}
        if (!taskList || !task || typeof task.id === 'undefined') {
            console.error("Cannot add task to list. Invalid input or list element missing.", task);
            return;
        }

        const li = document.createElement('li');
        // Use Bootstrap classes for list group item + flexbox for layout
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
        li.dataset.taskId = task.id;

        // Div for checkbox and task text (takes up remaining space)
        const taskContentDiv = document.createElement('div');
        taskContentDiv.className = 'd-flex align-items-center me-3'; // Add margin-end for spacing before buttons

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input task-checkbox me-2'; // Margin end for space after checkbox
        checkbox.checked = task.completed;
        checkbox.dataset.taskId = task.id;

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.content;

        taskContentDiv.appendChild(checkbox);
        taskContentDiv.appendChild(span);

        // Div for ALL buttons (groups them together)
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'task-buttons btn-group'; // Use Bootstrap btn-group for spacing/styling if desired

        // Create ALL buttons
        const aiButton = document.createElement('button');
        aiButton.className = 'ask-ai-btn btn btn-info btn-sm'; // Removed extra margins, btn-group handles it
        aiButton.textContent = 'Ask AI';
        aiButton.dataset.taskText = task.content; // Make sure task.content is correct

        const motivateButton = document.createElement('button');
        motivateButton.className = 'motivate-me-btn btn btn-success btn-sm';
        motivateButton.textContent = 'Motivate Me!';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn btn btn-danger btn-sm';
        deleteButton.textContent = 'Delete';
        deleteButton.dataset.taskId = task.id;

        // Append buttons to buttonDiv
        buttonDiv.appendChild(aiButton);
        buttonDiv.appendChild(motivateButton);
        buttonDiv.appendChild(deleteButton);

        // Assemble the list item
        li.appendChild(taskContentDiv); // Checkbox and Text
        li.appendChild(buttonDiv);    // Buttons div

        // Add the new list item to the list
        taskList.appendChild(li);

        // Hide 'no tasks' message if it exists and was visible
        if (noTasksMsg) {
            noTasksMsg.style.display = 'none';
        }
    }
    // --- End Section 4 ---


    // --- SECTION 5: Event Handler Functions ---

    // Handles 'Ask AI' button clicks
    async function handleAskAiClick(button, taskText) {
        // Safety check before sending request
        if (!taskText || taskText.trim() === "") {
            alert("Cannot ask AI about an empty task.");
            return;
        }

        button.disabled = true;
        const originalText = button.textContent; // Store original text
        button.textContent = 'Asking...';

        try {
            const response = await fetch('/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_text: taskText })
            });
            const result = await response.json();
            // Pass the task text itself as the title for the modal
            displayModalResponse(`AI Details for "${taskText}"`, result, response.ok, "Error fetching AI details:");
        } catch (error) {
            console.error('Network or fetch error (Ask AI):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not contact AI service:");
        } finally {
            button.disabled = false;
            button.textContent = originalText; // Restore original text
        }
    }

    // Handles 'Motivate Me' button clicks
    async function handleMotivateMeClick(button) {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Thinking...';

        try {
            const response = await fetch('/motivate-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
                // No body needed for this request as per your backend
            });
            const result = await response.json();
            displayModalResponse("A Dose of Motivation!", result, response.ok, "Error fetching motivation:", 'motivation'); // Specify 'motivation' key
        } catch (error) {
            console.error('Network or fetch error (Motivate Me):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not get motivation:");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    // Handles Checkbox changes
    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked;
        const listItem = checkbox.closest('.task-item');
        if (!listItem) return; // Should not happen if checkbox is in a task item

        // Optimistic UI update
        listItem.classList.toggle('task-completed', isCompleted);

        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                 // No body needed if backend just toggles based on ID
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                // Rollback UI on server error
                console.error('Error updating task status:', result.error || 'Unknown server error');
                checkbox.checked = !isCompleted; // Revert checkbox
                listItem.classList.toggle('task-completed', !isCompleted); // Revert style
                alert(`Error updating task: ${result.error || 'Server error'}`);
            } else {
                // Confirm UI matches actual state from server response
                checkbox.checked = result.completed_status;
                listItem.classList.toggle('task-completed', result.completed_status);
                console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
            }
        } catch (error) {
            // Rollback UI on network error
            console.error('Network or fetch error (Complete Task):', error);
            checkbox.checked = !isCompleted; // Revert checkbox
            listItem.classList.toggle('task-completed', !isCompleted); // Revert style
            alert('Failed to update task status. Check network connection.');
        }
    }

    // Handles Delete button clicks <<--- DEFINITION MOVED HERE
    async function handleDeleteClick(button, taskId) {
        if (!confirm(`Are you sure you want to delete task ID: ${taskId}? This cannot be undone.`)) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Deleting...';
        const listItem = button.closest('.task-item');

        try {
            const response = await fetch(`/delete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                if (listItem) {
                    listItem.remove();
                    console.log(`Task ${taskId} deleted successfully from DOM.`);
                    // Check if list is now empty and show message
                    if (taskList && taskList.children.length === 0 && noTasksMsg) {
                        noTasksMsg.style.display = 'block';
                    }
                } else {
                    console.warn(`Could not find list item for task ${taskId} to remove. Attempting reload.`);
                    location.reload(); // Fallback: reload the page if UI element not found
                }
            } else {
                console.error('Error deleting task:', result.error || 'Unknown server error');
                alert(`Error deleting task: ${result.error || 'Server error'}`);
                button.disabled = false; // Re-enable on failure
                button.textContent = 'Delete';
            }
        } catch (error) {
            console.error('Network or fetch error (Delete Task):', error);
            alert('Failed to delete task. Check network connection.');
            button.disabled = false; // Re-enable on network failure
            button.textContent = 'Delete';
        }
    }


    // Helper function to display modal response (handles AI details and Motivation)
    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
         if (!modalTitleSpan || !modalBody || !aiModalElement) {
            console.error("Modal elements not found! Cannot display response.");
            // Attempt to alert the raw message if modal elements are missing
            alert(isOk ? (result[responseKey] || "Received empty response.") : `${errorPrefix} ${result.error || 'UI Error: Modal components missing.'}`);
            return;
         }
         if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
             console.error("Bootstrap JavaScript or Modal component not loaded!");
             alert("Error: UI Component (Modal) failed to load.");
             return;
         }

        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement);

        modalTitleSpan.textContent = title; // Set title regardless of success/error

        if (isOk) {
             // Format the response text slightly for better readability in the modal
            const formattedText = (result[responseKey] || "Received empty response.")
                .replace(/\n/g, '<br>'); // Replace newlines with <br> for HTML display
            modalBody.innerHTML = formattedText; // Use innerHTML since we added <br>
        } else {
            modalBody.innerText = `${errorPrefix} ${result.error || 'Unknown server error'}`;
        }
        aiModal.show();
    }
    // --- End Section 5 ---


    // --- SECTION 6: Initial Setup for Existing Tasks ---
    // Ensures tasks loaded server-side get the correct 'task-completed' class applied initially
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        const listItem = checkbox.closest('.task-item');
        if (listItem) {
             listItem.classList.toggle('task-completed', checkbox.checked);
        }
    });

    // Check if the task list is empty on initial load and show message
    if (taskList && taskList.children.length === 0 && noTasksMsg) {
         noTasksMsg.style.display = 'block';
     } else if (noTasksMsg) {
        noTasksMsg.style.display = 'none';
     }
    // --- End Section 6 ---


    // --- SECTION 7: Theme Toggling Logic ---
    (function applyThemePreference() { // IIFE to avoid polluting global scope
        const currentStoredTheme = localStorage.getItem('theme');
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = (theme) => {
            let buttonText = "Dark Mode 🌓"; // Default for Light theme button
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
                buttonText = "Light Mode ☀️"; // For Dark theme button
            } else {
                document.documentElement.removeAttribute('data-bs-theme');
            }
            if(themeToggleButton) themeToggleButton.textContent = buttonText;
        };

        let initialTheme = currentStoredTheme;
        if (!initialTheme) {
             initialTheme = prefersDarkScheme.matches ? 'dark' : 'light';
        }
        applyTheme(initialTheme);

        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', () => {
                // Read the current theme *directly* from the attribute for consistency
                let currentTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
                let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });
        } else {
            console.warn("Theme toggle button (#theme-toggle-btn) not found!");
        }
    })(); // Immediately execute the theme setup function
    // --- END SECTION 7 ---

}); // End of DOMContentLoaded listener