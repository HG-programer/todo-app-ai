document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal');
    const modalTitleSpan = document.getElementById('modalTaskTitle'); // Expected within modal header
    const modalBody = document.getElementById('aiResponseModalBody'); // Expected within modal body
    const noTasksMsg = document.getElementById('noTasksMessage'); // Message shown when list is empty
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const globalMotivateButton = document.getElementById('global-motivate-button'); // New global button
    // --- End Section 1 ---

    // --- Helper: Prevent XSS ---
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&',
                '<': '<',
                '>': '>',
                '"': '"',
                "'": '&#39;'
            }[match];
        });
    }

    // --- SECTION 2: Core Task Submission Logic ---
    // Handles sending the task data to the backend and updating UI on success/failure
    async function submitNewTask(taskContent) {
        if (!taskContent || taskContent.trim() === "") {
            console.warn("Attempted to submit empty task.");
            alert("Task content cannot be empty."); // Give user feedback
            return; // Don't proceed
        }

        const submitButton = addTaskForm ? addTaskForm.querySelector('button[type="submit"]') : null;
        const originalButtonHTML = submitButton ? submitButton.innerHTML : 'Add Task'; // Store original HTML

        // Show loading state on Add button
        if(submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`;
        }
        // Also disable voice button if it exists, as background process is running
        if(voiceInputBtn) voiceInputBtn.disabled = true;

        try {
            const response = await fetch("/add", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: taskContent })
            });
            const result = await response.json();

            if (response.status === 201 && result.success && result.task) {
                addNewTaskToList(result.task); // Add visually
                if(taskInput) taskInput.value = ''; // Clear input field only on success
                console.log(`Task "${taskContent}" added successfully.`);
            } else {
                console.error("Error adding task (server):", result.error || `Status: ${response.status}`);
                alert(`Error adding task: ${result.error || 'Unknown server error'}`);
                // Optionally, put content back in input if adding failed?
                // if(taskInput) taskInput.value = taskContent;
            }
        } catch (error) {
            console.error('Network or fetch error adding task:', error);
            alert(`Failed to add task. Error: ${error.message}. Check the console.`);
             // Optionally, put content back in input if adding failed?
             // if(taskInput) taskInput.value = taskContent;
        } finally {
            // Restore Add button state
            if(submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHTML; // Restore original text/HTML
            }
            // Re-enable voice button (if not actively listening)
            // It will be properly reset by recognition.onend if voice was the trigger
            if(voiceInputBtn && (!recognition || recognition.recording === false)) { // Avoid race conditions with recognizer
               resetVoiceButton(); // Reset if not actively managed by recognition lifecycle
            }
        }
    }
    // --- End Section 2 ---


    // --- SECTION 3: Add Task Form Event Listener ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const taskText = taskInput.value.trim();
            submitNewTask(taskText); // Use the refactored submission function
        });
    } else {
        console.error("Add Task form (#addTaskForm) not found!");
    }
    // --- End Section 3 ---


    // --- SECTION 4: Task List Event Delegation ---
    if (taskList) {
        // Handle clicks on buttons WITHIN task items
        taskList.addEventListener('click', async (event) => {
            const target = event.target;
            const button = target.closest('button'); // Find the nearest parent button
            if (!button) return; // Exit if the click wasn't on or inside a button

            const listItem = button.closest('.task-item');
            if (!listItem) return; // Should always find this if button is inside a task

            const taskId = listItem.dataset.taskId;

            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText; // Get text from data attribute
                handleAskAiClick(button, taskText);
            }
            // Note: Per-task motivate button removed
            else if (button.classList.contains('delete-btn')) {
                handleDeleteClick(button, taskId);
            }
        });

        // Handle checkbox changes
        taskList.addEventListener('change', async (event) => {
             const target = event.target;
            if (target.classList.contains('task-checkbox') && target.type === 'checkbox') {
                const checkbox = target;
                const listItem = checkbox.closest('.task-item');
                if (!listItem) return;
                const taskId = listItem.dataset.taskId;
                handleCheckboxChange(checkbox, taskId);
            }
        });
    } else {
        console.error("Task list (#taskList) element not found!");
    }
    // --- End Section 4 ---


    // --- SECTION 5: Helper Function to Create and Add New Task LI Element ---
    function addNewTaskToList(task) {
        if (!taskList || !task || typeof task.id === 'undefined') {
            console.error("Cannot add task to list - invalid input or list element missing.", task);
            return;
        }
        const li = document.createElement('li');
        // Set base classes WITHOUT animation initially
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
        li.dataset.taskId = task.id; // Store ID on the LI element

        // --- Create internal elements ---
        const taskContentDiv = document.createElement('div');
        taskContentDiv.className = 'd-flex align-items-center me-3 flex-grow-1'; // Allow text to grow

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input task-checkbox me-2';
        checkbox.checked = task.completed;
        checkbox.id = `task-${task.id}`; // Unique ID for label association

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.content; // Use textContent for safety (like escapeHTML)
        // If you need clickable text for editing later, wrap span in a label:
        // const label = document.createElement('label');
        // label.htmlFor = checkbox.id;
        // label.className = 'task-text ms-1'; // Added ms-1 for spacing
        // label.textContent = task.content;

        taskContentDiv.appendChild(checkbox);
        taskContentDiv.appendChild(span); // Use span or label here

        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'task-buttons btn-group'; // Use btn-group for better spacing/styling

        const aiButton = document.createElement('button');
        aiButton.type = "button";
        aiButton.className = 'ask-ai-btn btn btn-outline-info btn-sm'; // Use outline style
        aiButton.title = "Ask AI about this task";
        aiButton.dataset.taskText = task.content; // Store full text for AI prompt
        aiButton.innerHTML = '<i class="bi bi-magic"></i> <span class="visually-hidden">Ask AI</span>'; // Icon + Screen reader text

        const deleteButton = document.createElement('button');
        deleteButton.type = "button";
        deleteButton.className = 'delete-btn btn btn-outline-danger btn-sm'; // Use outline style
        deleteButton.title = "Delete this task";
        deleteButton.innerHTML = '<i class="bi bi-trash"></i> <span class="visually-hidden">Delete</span>'; // Icon + Screen reader text

        buttonDiv.appendChild(aiButton);
        // Note: Per-task Motivate button removed
        buttonDiv.appendChild(deleteButton);
        // --- End Create internal elements ---

        li.appendChild(taskContentDiv);
        li.appendChild(buttonDiv);

        // --- Append FIRST, then add animation class ---
        taskList.appendChild(li);

        // Add the fade-in class slightly after appending
        requestAnimationFrame(() => {
             li.classList.add('task-fade-in');
        });

        // Remove the class after animation
        li.addEventListener('animationend', () => {
            li.classList.remove('task-fade-in');
        }, { once: true });

        // Hide the 'no tasks' message if it's visible
        if (noTasksMsg && noTasksMsg.style.display !== 'none') {
            noTasksMsg.style.display = 'none';
        }
    }
    // --- End Section 5 ---


    // --- SECTION 6: Task Action Handlers (Ask AI, Delete, Complete) ---

    // Handles 'Ask AI' button clicks
    async function handleAskAiClick(button, taskText) {
        if (!taskText || taskText.trim() === "") {
            alert("Cannot ask AI about an empty task.");
            return;
        }
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Asking...</span>`; // Spinner + SR text

        try {
            const response = await fetch('/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_text: taskText })
            });
            const result = await response.json();
            // Use escapeHTML for displaying user-provided task text in title
            displayModalResponse(`AI Details for "${escapeHTML(taskText)}"`, result, response.ok, "Error fetching AI details:");
        } catch (error) {
            console.error('Network or fetch error (Ask AI):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not contact AI service:");
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent; // Restore original icon/content
        }
    }

    // Handles Checkbox changes (Toggling completion status)
    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked;
        const listItem = checkbox.closest('.task-item');
        if (!listItem) return;

        // Optimistic UI update (apply style immediately)
        listItem.classList.toggle('task-completed', isCompleted);

        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Though body is empty, header is good practice
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                // Rollback UI on error
                console.error('Error updating task status:', result.error || 'Unknown server error');
                checkbox.checked = !isCompleted; // Revert checkbox
                listItem.classList.toggle('task-completed', !isCompleted); // Revert style
                alert(`Error updating task: ${result.error || 'Server error'}`);
            } else {
                // Server confirmed, ensure UI matches final state from server
                checkbox.checked = result.completed_status;
                listItem.classList.toggle('task-completed', result.completed_status);
                console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
            }
        } catch (error) {
            // Rollback UI on network error
            console.error('Network error (Complete Task):', error);
            checkbox.checked = !isCompleted; // Revert checkbox
            listItem.classList.toggle('task-completed', !isCompleted); // Revert style
            alert('Failed to update task status. Please check your network connection.');
        }
    }

    // Handles Delete button clicks
    async function handleDeleteClick(button, taskId) {
        // Use Bootstrap modal for confirmation later? For now, confirm() is fine.
        if (!confirm(`Are you sure you want to delete this task?`)) {
            return;
        }
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Deleting...</span>`; // Spinner + SR
        const listItem = button.closest('.task-item');

        if (!listItem) {
            console.error("Could not find list item to delete visually.");
            button.disabled = false; // Restore button if visual element not found
            button.innerHTML = originalContent;
            return;
        }

        try {
            const response = await fetch(`/delete/${taskId}`, {
                method: 'POST',
                // No body needed, ID is in URL
            });
            const result = await response.json();

            if (response.ok && result.success) {
                console.log(`Task ${taskId} delete request successful.`);
                // Apply fade-out animation BEFORE removing
                listItem.classList.add('task-fade-out');
                listItem.addEventListener('animationend', () => {
                    listItem.remove(); // Remove element ONLY after animation ends
                    console.log(`Task ${taskId} removed from DOM.`);
                    // Check if list is now empty AFTER removing the element
                    if (taskList && taskList.children.length === 0 && noTasksMsg) {
                        noTasksMsg.style.display = 'block'; // Show message if list empty
                    }
                }, { once: true });
            } else {
                console.error('Error deleting task (server):', result.error || 'Unknown server error');
                alert(`Error deleting task: ${result.error || 'Server error'}`);
                button.disabled = false; // Restore button on server failure
                button.innerHTML = originalContent;
            }
        } catch (error) {
            console.error('Network error (Delete Task):', error);
            alert('Failed to delete task. Check network connection.');
            button.disabled = false; // Restore button on network failure
            button.innerHTML = originalContent;
        }
    }
    // --- End Section 6 ---


    // --- SECTION 7: General Motivation Handling ---
    // Function to fetch and display general motivation (called by voice or global button)
    async function triggerGeneralMotivation() {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(aiModalElement);

        // Show loading state in modal immediately
        if (modalTitleSpan) modalTitleSpan.textContent = 'Getting Motivation...';
        if (modalBody) modalBody.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        modalInstance.show();

        // Also show loading on the global motivate button if it exists
        const originalButtonHTML = globalMotivateButton ? globalMotivateButton.innerHTML : null;
        if(globalMotivateButton) {
             globalMotivateButton.disabled = true;
             globalMotivateButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Thinking...`;
        }

        try {
            const response = await fetch('/motivate-me', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) {
                // Throw an error to be caught by the catch block
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            // Display success
            if (modalTitleSpan) modalTitleSpan.textContent = 'A Dose of Motivation!';
            if (modalBody) {
                // Use blockquote for better formatting
                 modalBody.innerHTML = `
                    <blockquote class="blockquote mb-0">
                        <p>${escapeHTML(result.motivation)}</p>
                    </blockquote>
                 `;
            }
        } catch (error) {
            console.error('Error fetching motivation:', error);
            // Display error in modal
            if (modalTitleSpan) modalTitleSpan.textContent = 'Error';
            if (modalBody) modalBody.textContent = `Sorry, couldn't get motivation: ${error.message}`;
        } finally {
            // Restore global motivate button state
             if(globalMotivateButton && originalButtonHTML) {
                 globalMotivateButton.disabled = false;
                 globalMotivateButton.innerHTML = originalButtonHTML;
            }
            // Modal is left open for user to read/close
        }
    }

    // Add event listener for the *global* motivate button
    if (globalMotivateButton) {
        globalMotivateButton.addEventListener('click', triggerGeneralMotivation);
    } else {
        console.log("Global motivate button (#global-motivate-button) not found. Motivation only available via voice command.");
    }

    // Helper function to display modal response (used by Ask AI)
    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
         if (!modalTitleSpan || !modalBody || !aiModalElement) {
            console.error("Modal elements missing! Cannot display response.");
            alert(isOk ? (result[responseKey] || "Empty response.") : `${errorPrefix} ${result.error || 'UI Error.'}`);
            return;
         }
         if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
             console.error("Bootstrap Modal component not loaded!");
             alert("UI Component (Modal) error.");
             return;
         }
        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement);
        modalTitleSpan.textContent = title; // Already escaped if needed by caller
        if (isOk) {
            // Use escapeHTML for the AI response itself before adding line breaks
            modalBody.innerHTML = escapeHTML(result[responseKey] || "Received empty response from AI.").replace(/\n/g, '<br>');
        } else {
            modalBody.textContent = `${errorPrefix} ${result.error || 'Unknown server error'}`;
        }
        aiModal.show();
    }
    // --- End Section 7 ---


    // --- SECTION 8: Initial UI Setup ---
    // Set initial state for existing tasks (e.g., completed class)
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        const listItem = checkbox.closest('.task-item');
        if (listItem) {
             listItem.classList.toggle('task-completed', checkbox.checked);
        }
    });

    // Check if task list is empty on load and show message if needed
    if (taskList && taskList.children.length === 0 && noTasksMsg) {
         noTasksMsg.style.display = 'block';
     } else if (noTasksMsg) {
        noTasksMsg.style.display = 'none';
     }
    // --- End Section 8 ---


    // --- SECTION 9: Theme Toggling Logic ---
    (function applyThemePreference() {
        const currentStoredTheme = localStorage.getItem('theme');
        // Default to light unless stored preference or system preference is dark
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        let initialTheme = 'light'; // Default to light

        if (currentStoredTheme) {
            initialTheme = currentStoredTheme;
        } else if (prefersDarkScheme.matches) {
            initialTheme = 'dark';
        }

        const applyTheme = (theme) => {
            let buttonText = 'Dark Mode <i class="bi bi-moon-stars-fill"></i>'; // Default: button switches TO dark
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
                buttonText = 'Light Mode <i class="bi bi-sun-fill"></i>'; // Dark active: button switches TO light
            } else {
                document.documentElement.removeAttribute('data-bs-theme');
            }
            if(themeToggleButton) themeToggleButton.innerHTML = buttonText; // Use innerHTML for icons
        };

        applyTheme(initialTheme); // Apply on load

        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', () => {
                // Check the current theme FROM the attribute
                let currentTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
                let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme); // Apply visually
                localStorage.setItem('theme', newTheme); // Store preference
            });
        } else {
            console.warn("Theme toggle button (#theme-toggle-btn) not found!");
        }
    })();
    // --- End Section 9 ---


    // --- SECTION 10: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let recognitionActive = false; // Flag to track if recognition process is ongoing

    // Function to update voice button appearance
    function updateVoiceButtonState(state) { // States: 'idle', 'listening', 'processing'
         if (!voiceInputBtn) return;
         const icon = voiceInputBtn.querySelector('i');
         if (!icon) return;

         voiceInputBtn.disabled = (state !== 'idle'); // Disable unless idle

        if (state === 'listening') {
             voiceInputBtn.classList.remove('btn-primary', 'btn-secondary');
             voiceInputBtn.classList.add('btn-danger'); // Red indicates recording
             icon.className = 'bi bi-record-circle-fill'; // Recording icon
             if(taskInput) taskInput.placeholder = "Listening...";
         } else if (state === 'processing') {
             voiceInputBtn.classList.remove('btn-primary', 'btn-danger');
             voiceInputBtn.classList.add('btn-secondary'); // Grey indicates processing
             icon.className = 'bi bi-hourglass-split'; // Processing icon
              if(taskInput) taskInput.placeholder = "Processing voice input...";
         } else { // idle state
             voiceInputBtn.classList.remove('btn-danger', 'btn-secondary');
             voiceInputBtn.classList.add('btn-primary'); // Back to default blue
             icon.className = 'bi bi-mic-fill'; // Default mic icon
             if(taskInput) taskInput.placeholder = "What needs doing? Or use the mic!";
             recognitionActive = false; // Ensure flag is reset when truly idle
         }
    }
     // Alias for idle state reset
    function resetVoiceButton() {
        updateVoiceButtonState('idle');
    }


    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Process single utterances
        recognition.lang = 'en-US';     // Language
        recognition.interimResults = false; // We only care about the final result
        recognition.maxAlternatives = 1;   // Get the single best guess

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => {
                 if (recognitionActive) {
                     console.log("Recognition already active, stopping.");
                     recognition.stop(); // Allow stopping mid-listen
                     // State will transition via onend
                     return;
                 }
                try {
                    recognition.start();
                    recognitionActive = true; // Set flag
                    // State updated via onstart
                } catch(e) {
                    // This usually happens if start() is called again before 'end' event
                    console.error("Voice recognition start error:", e);
                    alert("Could not start voice recognition. Is the microphone busy or blocked?");
                    resetVoiceButton(); // Reset state if start fails
                }
            });

            // --- Recognition Event Handlers ---
             recognition.onstart = () => {
                 console.log("Voice recognition started.");
                 updateVoiceButtonState('listening');
             };

            recognition.onresult = (event) => {
                console.log("Voice recognition result received.");
                updateVoiceButtonState('processing'); // Indicate processing before handling

                let transcript = "";
                if (event.results && event.results.length > 0 && event.results[0].length > 0) {
                    transcript = event.results[0][0].transcript.trim();
                     console.log('Transcript:', transcript, 'Confidence:', event.results[0][0].confidence);
                } else {
                     console.warn("Received result event with no transcript.");
                     // State reset will happen in onend
                     return; // Nothing to process
                 }


                if (transcript === "") {
                    console.log("Empty transcript received.");
                     if(taskInput) taskInput.placeholder = "Didn't catch that.";
                     // State reset will happen in onend
                    return; // Ignore empty results
                }

                const lowerCaseTranscript = transcript.toLowerCase();

                // --- Command Parsing Logic ---
                if (lowerCaseTranscript.includes('motivate') || lowerCaseTranscript.includes('motivation')) {
                    console.log("Voice Command Detected: Triggering Motivation");
                    triggerGeneralMotivation(); // Call the dedicated motivation function
                    // Let triggerGeneralMotivation handle its button states
                    // Voice button state will be reset in onend
                }
                // --- Add more 'else if' blocks here for future commands ---
                // else if (lowerCaseTranscript.startsWith('delete task')) { ... }
                else {
                    // --- Default Action: Add Task ---
                    console.log("Voice Input Detected: Adding Task - ", transcript);
                    submitNewTask(transcript); // Use the refactored submission function
                    // submitNewTask handles its own button states (Add button)
                    // Voice button state will be reset in onend
                }
            }; // End of onresult

             recognition.onspeechend = () => {
                 console.log("Speech end detected.");
                 recognition.stop(); // Explicitly stop listening
                 // State will transition via onend
             };

            recognition.onnomatch = () => {
                 console.warn("Speech not recognized (no match).");
                 if(taskInput) taskInput.placeholder = "Couldn't understand that.";
                 // State reset will happen in onend
             };

            recognition.onerror = (event) => {
                console.error(`Speech Recognition Error: ${event.error}`);
                let msg = `Speech Error: ${event.error}`;
                if (event.error === 'no-speech') msg = "No speech detected.";
                else if (event.error === 'audio-capture') msg = "Microphone error.";
                else if (event.error === 'not-allowed') msg = "Microphone permission denied.";
                else if (event.error === 'network') msg = "Network error during recognition.";
                if(taskInput) taskInput.placeholder = msg; // Show brief error in placeholder
                alert(msg + " Please check microphone/permissions."); // Alert for details
                 // State reset will happen in onend
            };

            recognition.onend = () => {
                console.log("Voice recognition ended.");
                // ALWAYS reset the button state when recognition stops for any reason
                resetVoiceButton();
                recognitionActive = false; // Clear flag
            };

        } else {
            console.warn("Voice input button (#voiceInputBtn) not found! Voice commands disabled.");
        }
    } else {
        // SpeechRecognition API not supported in this browser
        console.warn("SpeechRecognition API not supported by this browser.");
        if (voiceInputBtn) {
            voiceInputBtn.disabled = true;
            voiceInputBtn.title = "Voice input not supported by your browser";
            voiceInputBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>'; // Muted icon
        }
    }
    // --- End Section 10 ---

}); // End of DOMContentLoaded listener