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

}); // End of DOMContentLoaded listener