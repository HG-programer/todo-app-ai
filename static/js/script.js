document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal');
    const modalTitleSpan = document.getElementById('modalTaskTitle');
    const modalBody = document.getElementById('aiResponseModalBody');
    const noTasksMsg = document.getElementById('noTasksMessage');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
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
            const originalButtonText = submitButton.textContent; // Store original text
            submitButton.disabled = true;
            // Add spinner for Add Task button
            submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`;

            try {
                const response = await fetch("/add", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: taskText })
                });
                const result = await response.json();

                if (response.status === 201 && result.success) {
                    addNewTaskToList(result.task);
                    taskInput.value = '';
                } else {
                    console.error("Error adding task:", result.error || `Status: ${response.status}`);
                    alert(`Error adding task: ${result.error || 'Unknown server error'}`);
                }
            } catch (error) {
                console.error('Network or fetch error adding task:', error);
                alert(`Failed to add task. Error: ${error.message}. Check the console.`);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText; // Restore original text/HTML
            }
        });
    } else {
        console.error("Add Task form (#addTaskForm) not found!");
    }
    // --- End Section 2 ---


    // --- SECTION 3: Task List Event Delegation ---
    if (taskList) {
        taskList.addEventListener('click', async (event) => {
            const target = event.target;
            const button = target.closest('button');
            if (!button) return;

            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText;
                handleAskAiClick(button, taskText);
            } else if (button.classList.contains('motivate-me-btn')) {
                handleMotivateMeClick(button);
            } else if (button.classList.contains('delete-btn')) {
                const taskId = button.dataset.taskId;
                handleDeleteClick(button, taskId);
            }
        });

        taskList.addEventListener('change', async (event) => {
             const target = event.target;
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
function addNewTaskToList(task) {
    if (!taskList || !task || typeof task.id === 'undefined') {
        console.error("Cannot add task to list.", task);
        return;
    }
    const li = document.createElement('li');
    // Set base classes WITHOUT animation initially
    li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
    li.dataset.taskId = task.id;

    // --- Create internal elements (taskContentDiv, buttonDiv, etc.) ---
    // ... (code for checkbox, span, buttons as before) ...
    const taskContentDiv = document.createElement('div');
    taskContentDiv.className = 'd-flex align-items-center me-3';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.className = 'form-check-input task-checkbox me-2';
    checkbox.checked = task.completed; checkbox.dataset.taskId = task.id;
    const span = document.createElement('span'); span.className = 'task-text';
    span.textContent = task.content;
    taskContentDiv.appendChild(checkbox); taskContentDiv.appendChild(span);

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'task-buttons btn-group';
    const aiButton = document.createElement('button');
    aiButton.type = "button"; aiButton.className = 'ask-ai-btn btn btn-info btn-sm';
    aiButton.textContent = 'Ask AI'; aiButton.dataset.taskText = task.content;
    const motivateButton = document.createElement('button');
    motivateButton.type = "button"; motivateButton.className = 'motivate-me-btn btn btn-success btn-sm';
    motivateButton.textContent = 'Motivate Me!';
    const deleteButton = document.createElement('button');
    deleteButton.type = "button"; deleteButton.className = 'delete-btn btn btn-danger btn-sm';
    deleteButton.textContent = 'Delete'; deleteButton.dataset.taskId = task.id;
    buttonDiv.appendChild(aiButton); buttonDiv.appendChild(motivateButton);
    buttonDiv.appendChild(deleteButton);
    // --- End Create internal elements ---

    li.appendChild(taskContentDiv);
    li.appendChild(buttonDiv);

    // --- Append FIRST, then add animation class ---
    taskList.appendChild(li);

    // Add the fade-in class slightly after appending to trigger animation
    // Using requestAnimationFrame ensures the element is in the DOM before animating
    requestAnimationFrame(() => {
         li.classList.add('task-fade-in');
    });

    // Optionally remove the class after animation (cleaner DOM, prevents potential conflicts)
    li.addEventListener('animationend', () => {
        li.classList.remove('task-fade-in');
    }, { once: true }); // Important: run only once per animation


    if (noTasksMsg) {
        noTasksMsg.style.display = 'none';
    }

    // Optional Feedback: Show temporary message
    // showFeedbackMessage("Task added!", "success"); // Implement this function later if desired
}
    // --- End Section 4 ---


    // --- SECTION 5: Event Handler Functions ---

    // Handles 'Ask AI' button clicks <<-- UPDATED WITH SPINNER
    async function handleAskAiClick(button, taskText) {
        if (!taskText || taskText.trim() === "") {
            alert("Cannot ask AI about an empty task.");
            return;
        }
        button.disabled = true;
        const originalContent = button.innerHTML; // Store original HTML
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Asking...`;

        try {
            const response = await fetch('/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_text: taskText })
            });
            const result = await response.json();
            displayModalResponse(`AI Details for "${taskText}"`, result, response.ok, "Error fetching AI details:");
        } catch (error) {
            console.error('Network or fetch error (Ask AI):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not contact AI service:");
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent; // Restore original content
        }
    }

    // Handles 'Motivate Me' button clicks <<-- UPDATED WITH SPINNER
    async function handleMotivateMeClick(button) {
        button.disabled = true;
        const originalContent = button.innerHTML; // Store original HTML
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Thinking...`;

        try {
            const response = await fetch('/motivate-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            displayModalResponse("A Dose of Motivation!", result, response.ok, "Error fetching motivation:", 'motivation');
        } catch (error) {
            console.error('Network or fetch error (Motivate Me):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not get motivation:");
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent; // Restore original content
        }
    }

    // Handles Checkbox changes (No spinner needed here)
    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked;
        const listItem = checkbox.closest('.task-item');
        if (!listItem) return;
        listItem.classList.toggle('task-completed', isCompleted); // Optimistic update

        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Error updating task status:', result.error || 'Unknown');
                checkbox.checked = !isCompleted; // Rollback
                listItem.classList.toggle('task-completed', !isCompleted);
                alert(`Error updating task: ${result.error || 'Server error'}`);
            } else {
                checkbox.checked = result.completed_status; // Confirm state
                listItem.classList.toggle('task-completed', result.completed_status);
                console.log(`Task ${taskId} completed: ${result.completed_status}`);
            }
        } catch (error) {
            console.error('Network error (Complete Task):', error);
            checkbox.checked = !isCompleted; // Rollback
            listItem.classList.toggle('task-completed', !isCompleted);
            alert('Failed to update task. Check network.');
        }
    }

    // --- SECTION 5: Event Handler Functions ---
// ... (handleAskAiClick, handleMotivateMeClick, handleCheckboxChange are okay) ...

// Handles Delete button clicks <<-- UPDATED WITH FADE-OUT ANIMATION
async function handleDeleteClick(button, taskId) {
    if (!confirm(`Are you sure you want to delete task ID: ${taskId}?`)) {
        return;
    }
    button.disabled = true;
    const originalContent = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...`;
    const listItem = button.closest('.task-item');

    if (!listItem) {
        console.error("Could not find list item to delete visually.");
        // Optionally restore button state if list item not found visually
        button.disabled = false;
        button.innerHTML = originalContent;
        return; // Stop if we can't find the list item
    }

    try {
        const response = await fetch(`/delete/${taskId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Task ${taskId} delete request successful.`);
            // === Apply fade-out animation BEFORE removing ===
            listItem.classList.add('task-fade-out');
            listItem.addEventListener('animationend', () => {
                listItem.remove(); // Remove element ONLY after animation ends
                console.log(`Task ${taskId} removed from DOM.`);
                // Check if list is empty AFTER removing the element
                if (taskList && taskList.children.length === 0 && noTasksMsg) {
                    noTasksMsg.style.display = 'block';
                }
                // Optional Feedback:
                // showFeedbackMessage("Task deleted!", "success"); // Implement later if desired
            }, { once: true }); // Run listener only once

            // === DO NOT REMOVE IMMEDIATELY ===
            // listItem.remove(); // <<<--- REMOVE THIS LINE (it was here before)

        } else {
            console.error('Error deleting task (server):', result.error || 'Unknown');
            alert(`Error deleting task: ${result.error || 'Server error'}`);
            button.disabled = false; // Restore button on server failure
            button.innerHTML = originalContent;
        }
    } catch (error) {
        console.error('Network error (Delete Task):', error);
        alert('Failed to delete task. Check network.');
        button.disabled = false; // Restore button on network failure
        button.innerHTML = originalContent;
    }
}

// ... (displayModalResponse is okay) ...

    // Helper function to display modal response
    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
         if (!modalTitleSpan || !modalBody || !aiModalElement) {
            console.error("Modal elements missing!");
            alert(isOk ? (result[responseKey] || "Empty response.") : `${errorPrefix} ${result.error || 'UI Error.'}`);
            return;
         }
         if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
             console.error("Bootstrap Modal component not loaded!");
             alert("UI Component (Modal) error.");
             return;
         }
        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement);
        modalTitleSpan.textContent = title;
        if (isOk) {
            modalBody.innerHTML = (result[responseKey] || "Received empty response.").replace(/\n/g, '<br>');
        } else {
            modalBody.innerText = `${errorPrefix} ${result.error || 'Unknown server error'}`;
        }
        aiModal.show();
    }
    // --- End Section 5 ---


    // --- SECTION 6: Initial Setup for Existing Tasks ---
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        const listItem = checkbox.closest('.task-item');
        if (listItem) {
             listItem.classList.toggle('task-completed', checkbox.checked);
        }
    });
    if (taskList && taskList.children.length === 0 && noTasksMsg) {
         noTasksMsg.style.display = 'block';
     } else if (noTasksMsg) {
        noTasksMsg.style.display = 'none';
     }
    // --- End Section 6 ---


    // --- SECTION 7: Theme Toggling Logic ---
    (function applyThemePreference() {
        const currentStoredTheme = localStorage.getItem('theme');
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = (theme) => {
            let buttonText = "Dark Mode 🌓";
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
                buttonText = "Light Mode ☀️";
            } else {
                document.documentElement.removeAttribute('data-bs-theme');
            }
            if(themeToggleButton) themeToggleButton.textContent = buttonText;
        };
        let initialTheme = currentStoredTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
        applyTheme(initialTheme);
        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', () => {
                let currentTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
                let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });
        } else { console.warn("Theme toggle button not found!"); }
    })();
    // --- END SECTION 7 ---


    // --- SECTION 8: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-US';
        recognition.interimResults = false; recognition.maxAlternatives = 1;

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => {
                try {
                    recognition.start();
                    console.log("Voice rec started.");
                    voiceInputBtn.innerHTML = '<i class="bi bi-record-circle"></i>';
                    voiceInputBtn.disabled = true;
                    taskInput.placeholder = "Listening...";
                } catch(e) {
                    console.error("Voice start error:", e);
                    alert("Mic busy/blocked?"); resetVoiceButton();
                }
            });
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.trim();
                console.log('Voice Result:', transcript, 'Confidence:', event.results[0][0].confidence);
                if (transcript) { addTaskViaVoice(transcript); }
                else { taskInput.placeholder = "Didn't catch that."; }
            };
            recognition.onspeechend = () => { console.log("Speech end."); recognition.stop(); };
            recognition.onnomatch = () => { taskInput.placeholder = "Speech not recognized."; };
            recognition.onerror = (event) => {
                console.error(`Speech Error: ${event.error}`);
                let msg = `Speech Error: ${event.error}`;
                if (event.error === 'no-speech') msg = "No speech detected.";
                else if (event.error === 'audio-capture') msg = "Mic error.";
                else if (event.error === 'not-allowed') msg = "Mic permission denied.";
                else if (event.error === 'network') msg = "Network error.";
                taskInput.placeholder = msg; // Show brief error in placeholder
                alert(msg + " Please check mic/permissions."); // Alert for details
            };
            recognition.onend = () => { console.log("Voice rec ended."); resetVoiceButton(); };
        } else { console.warn("Voice button not found!"); }
    } else {
        console.warn("SpeechRecognition not supported.");
        if (voiceInputBtn) {
            voiceInputBtn.disabled = true; voiceInputBtn.title = "Voice not supported";
            voiceInputBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
        }
    }
    function resetVoiceButton() {
        if(voiceInputBtn) {
            voiceInputBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
            voiceInputBtn.disabled = false;
        }
        taskInput.placeholder = "What needs doing? Or use the mic!";
    }
    async function addTaskViaVoice(taskText) {
        console.log(`Adding task via voice: "${taskText}"`);
        const submitButton = addTaskForm.querySelector('button[type="submit"]');
        const originalAddBtnContent = submitButton ? submitButton.innerHTML : 'Add Task'; // Store original content
        // Temporarily show loading on main add button as well
        if(submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`;
        }
        // Keep voice button disabled during add process triggered by voice
        if(voiceInputBtn) voiceInputBtn.disabled = true;

        try {
            const response = await fetch("/add", {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: taskText })
            });
            const result = await response.json();
            if (response.status === 201 && result.success) {
                addNewTaskToList(result.task); taskInput.value = '';
                console.log(`Task "${taskText}" added via voice.`);
            } else {
                console.error("Error adding via voice:", result.error || `Status: ${response.status}`);
                taskInput.value = taskText; // Put back in input for manual edit/submit
                alert(`Error adding task "${taskText}": ${result.error || 'Unknown'}`);
            }
        } catch (error) {
            console.error('Network error adding via voice:', error);
            taskInput.value = taskText; // Put back in input
            alert(`Failed to add task "${taskText}". Network error.`);
        } finally {
            // Restore the main 'Add Task' button's state
             if(submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalAddBtnContent;
            }
            // The voice button state is handled by recognition.onend -> resetVoiceButton
        }
    }
    // --- End Section 8 ---

}); // End of DOMContentLoaded listener