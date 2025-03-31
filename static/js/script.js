document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal'); // Modal container
    const modalTitleSpan = document.getElementById('modalTaskTitle'); // Modal title element
    const modalBody = document.getElementById('aiResponseModalBody'); // Modal body element
    // --- End Section 1 ---


    // --- SECTION 2: Add Task Form Handling ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const taskText = taskInput.value.trim();
            if (taskText === "") {
                alert("Task content cannot be empty."); // Simple validation
                return;
            }

            const submitButton = addTaskForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';

            try {
                const response = await fetch("/add", { // Correct endpoint
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // === FIXED: Send 'content' key ===
                    body: JSON.stringify({ content: taskText }) // Backend expects 'content'
                });
                // ==================================

                const result = await response.json();

                if (response.status === 201 && result.success) {
                    // === FIXED: Pass the full task object from result ===
                    addNewTaskToList(result.task); // result.task contains {id, content, completed}
                    // ==================================================
                    taskInput.value = ''; // Clear input field
                    const noTasksMsg = document.getElementById('noTasksMessage');
                    if (noTasksMsg) {
                        noTasksMsg.style.display = 'none'; // Hide 'no tasks' message
                    }
                } else {
                    console.error("Error adding task:", result.error);
                    alert(`Error adding task: ${result.error || 'Unknown server error'}`);
                }

            } catch (error) {
                console.error('Network or fetch error adding task:', error);
                alert('Failed to add task. Check the console for details.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Add Task';
            }
        });
    } else {
        console.error("Add Task form (#addTaskForm) not found!");
    }
    // --- End Section 2 ---


    // --- SECTION 3: Task List Event Delegation (for Checkbox, Ask AI, Motivate Me) ---
    if (taskList) {
        taskList.addEventListener('click', async (event) => {
            const target = event.target;

            // --- Handle 'Ask AI' button clicks ---
            if (target.classList.contains('ask-ai-btn')) {
                const button = target;
                const taskText = button.dataset.taskText; // Get task text from data attribute
                handleAskAiClick(button, taskText); // Call specific handler
            }

            // --- Handle 'Motivate Me' button clicks ---
            else if (target.classList.contains('motivate-me-btn')) {
                const button = target;
                handleMotivateMeClick(button); // Call specific handler
            }
        });

        // Separate listener for 'change' events specifically for checkboxes
        taskList.addEventListener('change', async (event) => {
             const target = event.target;
             // --- Handle Checkbox changes ---
            if (target.classList.contains('task-checkbox')) {
                const checkbox = target;
                const taskId = checkbox.dataset.taskId;
                handleCheckboxChange(checkbox, taskId); // Call specific handler
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
        // === ADDED: Apply completed class based on task status ===
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
        li.dataset.taskId = task.id; // Add task ID to the li itself, might be useful

        // Div for checkbox and task text
        const taskContentDiv = document.createElement('div');
        taskContentDiv.className = 'd-flex align-items-center'; // Use flexbox for alignment

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input task-checkbox me-2'; // Added margin-end
        checkbox.checked = task.completed; // Set initial state
        checkbox.dataset.taskId = task.id; // Crucial for identifying which task to update

        // Task Text Span
        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.content;

        taskContentDiv.appendChild(checkbox);
        taskContentDiv.appendChild(span);

        // Div for buttons
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'task-buttons'; // Add a class for potential styling

        // Ask AI Button
        const aiButton = document.createElement('button');
        aiButton.className = 'ask-ai-btn btn btn-info btn-sm me-1'; // Added margin-end
        aiButton.textContent = 'Ask AI';
        aiButton.dataset.taskText = task.content; // Use task.content

        // Motivate Me Button
        const motivateButton = document.createElement('button');
        motivateButton.className = 'motivate-me-btn btn btn-success btn-sm'; // Example styling
        motivateButton.textContent = 'Motivate Me!';
        // No specific data needed unless you want task context later

        buttonDiv.appendChild(aiButton);
        buttonDiv.appendChild(motivateButton);

        // Assemble the list item
        li.appendChild(taskContentDiv);
        li.appendChild(buttonDiv);

        // Add the new list item to the list
        taskList.appendChild(li);
    }
    // --- End Section 4 ---


    // --- SECTION 5: Event Handler Functions ---

    // Handles 'Ask AI' button clicks
    async function handleAskAiClick(button, taskText) {
        button.disabled = true;
        button.textContent = 'Asking...';

        try {
            const response = await fetch('/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_text: taskText })
            });
            const result = await response.json();
            displayModalResponse(taskText, result, response.ok, "Error fetching AI details:");
        } catch (error) {
            console.error('Network or fetch error (Ask AI):', error);
            alert('Failed to contact the AI service. Check the console.');
        } finally {
            button.disabled = false;
            button.textContent = 'Ask AI';
        }
    }

    // Handles 'Motivate Me' button clicks
    async function handleMotivateMeClick(button) {
        button.disabled = true;
        button.textContent = 'Thinking...';

        try {
            const response = await fetch('/motivate-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            // Adjust title and expected key for motivation response
            displayModalResponse("A Dose of Motivation!", result, response.ok, "Error fetching motivation:", 'motivation');
        } catch (error) {
            console.error('Network or fetch error (Motivate Me):', error);
            alert('Failed to contact the AI motivation service. Check console.');
        } finally {
            button.disabled = false;
            button.textContent = 'Motivate Me!';
        }
    }

    // Handles Checkbox changes
    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked;
        const listItem = checkbox.closest('.task-item');

        // Optimistic UI update (optional but good for perceived speed)
        listItem.classList.toggle('task-completed', isCompleted);

        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                // --- Rollback UI on error ---
                console.error('Error updating task status:', result.error || 'Unknown server error');
                checkbox.checked = !isCompleted; // Revert checkbox
                listItem.classList.toggle('task-completed', !isCompleted); // Revert style
                alert(`Error updating task: ${result.error || 'Server error'}`);
            } else {
                // --- Confirm UI based on server response ---
                // This ensures UI matches the actual DB state if optimistic update was wrong
                // or if there was a slight delay and user clicked again.
                checkbox.checked = result.completed_status;
                listItem.classList.toggle('task-completed', result.completed_status);
                console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
            }
        } catch (error) {
            // --- Rollback UI on network error ---
            console.error('Network or fetch error (Complete Task):', error);
            checkbox.checked = !isCompleted; // Revert checkbox
            listItem.classList.toggle('task-completed', !isCompleted); // Revert style
            alert('Failed to update task status. Check network connection.');
        }
    }

    // --- Helper function to display modal response ---
    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
         if (!modalTitleSpan || !modalBody || !aiModalElement) {
            console.error("Modal elements not found!");
            alert("UI error: Cannot display AI response.");
            return;
        }
         if (typeof bootstrap === 'undefined') {
             console.error("Bootstrap JavaScript not loaded!");
             alert("Error: UI Component failed to load.");
             return;
         }

        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement); // Safer way to get/create instance

        if (isOk) {
            modalTitleSpan.textContent = title;
            modalBody.innerText = result[responseKey] || "Received empty response."; // Use the specified key
        } else {
            modalTitleSpan.textContent = "Error";
            modalBody.innerText = `${errorPrefix} ${result.error || 'Unknown server error'}`;
        }
        aiModal.show();
    }
    // --- End Section 5 ---


    // --- SECTION 6: Initial Setup for Existing Tasks (Checkboxes/Buttons) ---
    // Add listeners to any tasks already loaded on the page
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        // Listener attached via event delegation, but set initial class
        const listItem = checkbox.closest('.task-item');
        if (listItem) {
             listItem.classList.toggle('task-completed', checkbox.checked);
        }
    });
    // Ask AI/Motivate Me listeners are handled by delegation in Section 3
    // --- End Section 6 ---


    // --- SECTION 7: Theme Toggling Logic ---
    const currentStoredTheme = localStorage.getItem('theme');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (theme) => {
        let buttonText = "Toggle Theme 🌓"; // Default Light
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            buttonText = "Toggle Theme ☀️"; // Dark
        } else {
            document.documentElement.removeAttribute('data-bs-theme');
        }
         if(themeToggleButton) themeToggleButton.textContent = buttonText;
    };

    // Determine and apply initial theme
    let initialTheme = currentStoredTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
    applyTheme(initialTheme);

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            let currentTheme = document.documentElement.hasAttribute('data-bs-theme') ? 'dark' : 'light';
            let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    } else {
        console.error("Theme toggle button (#theme-toggle-btn) not found!");
    }
    // --- END SECTION 7 ---

}); // End of DOMContentLoaded listener