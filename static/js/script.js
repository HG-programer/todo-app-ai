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
    // CORRECTED the escape mappings
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&', // Fixed
                '<': '<',  // Fixed
                '>': '>',  // Fixed
                '"': '"', // Fixed
                "'": '&#39;'
            }[match];
        });
    }

    // --- SECTION 2: Core Task Submission Logic ---
    async function submitNewTask(taskContent) {
        if (!taskContent || taskContent.trim() === "") {
            console.warn("Attempted to submit empty task.");
            alert("Task content cannot be empty.");
            return;
        }

        const submitButton = addTaskForm ? addTaskForm.querySelector('button[type="submit"]') : null;
        const originalButtonHTML = submitButton ? submitButton.innerHTML : 'Add Task';

        if(submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`;
        }
        if(voiceInputBtn) voiceInputBtn.disabled = true;

        try {
            const response = await fetch("/add", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: taskContent })
            });
            const result = await response.json();

            if (response.status === 201 && result.success && result.task) {
                addNewTaskToList(result.task);
                if(taskInput) taskInput.value = '';
                console.log(`Task "${taskContent}" added successfully.`);
            } else {
                console.error("Error adding task (server):", result.error || `Status: ${response.status}`);
                alert(`Error adding task: ${result.error || 'Unknown server error'}`);
            }
        } catch (error) {
            console.error('Network or fetch error adding task:', error);
            alert(`Failed to add task. Error: ${error.message}. Check the console.`);
        } finally {
            if(submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHTML;
            }
            // Ensure voice button state is handled correctly by recognition lifecycle
             if(voiceInputBtn && (!recognitionActive)) { // Reset only if recognition isn't active
                 resetVoiceButton();
             }
        }
    }
    // --- End Section 2 ---


    // --- SECTION 3: Add Task Form Event Listener ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const taskText = taskInput.value.trim();
            submitNewTask(taskText);
        });
    } else {
        console.error("Add Task form (#addTaskForm) not found!");
    }
    // --- End Section 3 ---


    // --- SECTION 4: Task List Event Delegation ---
    if (taskList) {
        taskList.addEventListener('click', async (event) => {
            const target = event.target;
            const button = target.closest('button');
            if (!button) return;

            const listItem = button.closest('.task-item');
            if (!listItem) return;

            const taskId = listItem.dataset.taskId;

            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText;
                handleAskAiClick(button, taskText);
            } else if (button.classList.contains('delete-btn')) {
                // Calls the updated handleDeleteClick below
                handleDeleteClick(button, taskId); // Default call (skipConfirmation = false)
            }
        });

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
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
        li.dataset.taskId = task.id;

        const taskContentDiv = document.createElement('div');
        taskContentDiv.className = 'd-flex align-items-center me-3 flex-grow-1';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input task-checkbox me-2';
        checkbox.checked = task.completed;
        checkbox.id = `task-${task.id}`;

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.content;

        taskContentDiv.appendChild(checkbox);
        taskContentDiv.appendChild(span);

        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'task-buttons btn-group';

        const aiButton = document.createElement('button');
        aiButton.type = "button";
        aiButton.className = 'ask-ai-btn btn btn-outline-info btn-sm';
        aiButton.title = "Ask AI about this task";
        aiButton.dataset.taskText = task.content;
        aiButton.innerHTML = '<i class="bi bi-magic"></i> <span class="visually-hidden">Ask AI</span>';

        const deleteButton = document.createElement('button');
        deleteButton.type = "button";
        deleteButton.className = 'delete-btn btn btn-outline-danger btn-sm';
        deleteButton.title = "Delete this task";
        deleteButton.innerHTML = '<i class="bi bi-trash"></i> <span class="visually-hidden">Delete</span>';

        buttonDiv.appendChild(aiButton);
        buttonDiv.appendChild(deleteButton);

        li.appendChild(taskContentDiv);
        li.appendChild(buttonDiv);

        taskList.appendChild(li);

        requestAnimationFrame(() => {
             li.classList.add('task-fade-in');
        });

        li.addEventListener('animationend', () => {
            li.classList.remove('task-fade-in');
        }, { once: true });

        if (noTasksMsg && noTasksMsg.style.display !== 'none') {
            noTasksMsg.style.display = 'none';
        }
    }
    // --- End Section 5 ---


    // --- SECTION 6: Task Action Handlers (Ask AI, Delete, Complete) ---

    // Handles 'Ask AI' button clicks
    async function handleAskAiClick(button, taskText) {
        // ... (function content as before) ...
        if (!taskText || taskText.trim() === "") {
            alert("Cannot ask AI about an empty task.");
            return;
        }
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Asking...</span>`;

        try {
            const response = await fetch('/ask-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_text: taskText })
            });
            const result = await response.json();
            displayModalResponse(`AI Details for "${escapeHTML(taskText)}"`, result, response.ok, "Error fetching AI details:");
        } catch (error) {
            console.error('Network or fetch error (Ask AI):', error);
            displayModalResponse("Network Error", { error: error.message }, false, "Could not contact AI service:");
        } finally {
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    }

    // Handles Checkbox changes (Toggling completion status)
    async function handleCheckboxChange(checkbox, taskId) {
        // ... (function content as before) ...
         const isCompleted = checkbox.checked;
        const listItem = checkbox.closest('.task-item');
        if (!listItem) return;

        listItem.classList.toggle('task-completed', isCompleted);

        try {
            const response = await fetch(`/complete/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Error updating task status:', result.error || 'Unknown server error');
                checkbox.checked = !isCompleted;
                listItem.classList.toggle('task-completed', !isCompleted);
                alert(`Error updating task: ${result.error || 'Server error'}`);
            } else {
                checkbox.checked = result.completed_status;
                listItem.classList.toggle('task-completed', result.completed_status);
                console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
            }
        } catch (error) {
            console.error('Network error (Complete Task):', error);
            checkbox.checked = !isCompleted;
            listItem.classList.toggle('task-completed', !isCompleted);
            alert('Failed to update task status. Please check your network connection.');
        }
    }

    // Handles Delete button clicks - UPDATED with skipConfirmation parameter
    // This is the single, corrected version of the function.
    async function handleDeleteClick(button, taskId, skipConfirmation = false) {
        if (!skipConfirmation && !confirm(`Are you sure you want to delete this task?`)) {
            return; // User cancelled
        }

        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Deleting...</span>`;
        const listItem = button.closest('.task-item');

        if (!listItem) {
            console.error(`Could not find list item (ID: ${taskId}) to delete visually.`);
            if (!skipConfirmation) {
                 button.disabled = false;
                 button.innerHTML = originalContent;
            }
            return;
        }

        try {
            const response = await fetch(`/delete/${taskId}`, {
                method: 'POST',
            });
            const result = await response.json();

            if (response.ok && result.success) {
                console.log(`Task ${taskId} delete request successful (Confirmation skipped: ${skipConfirmation}).`);
                listItem.classList.add('task-fade-out');
                listItem.addEventListener('animationend', () => {
                    listItem.remove();
                    console.log(`Task ${taskId} removed from DOM.`);
                    if (taskList && taskList.children.length === 0 && noTasksMsg) {
                        noTasksMsg.style.display = 'block';
                    }
                }, { once: true });
            } else {
                console.error(`Error deleting task ${taskId} (server):`, result.error || 'Unknown server error');
                 if (!skipConfirmation) {
                    alert(`Error deleting task: ${result.error || 'Server error'}`);
                    button.disabled = false;
                    button.innerHTML = originalContent;
                 }
                 // Note: For skipped confirmation errors, we don't restore the button state here.
            }
        } catch (error) {
            console.error(`Network error (Delete Task ${taskId}):`, error);
             if (!skipConfirmation) {
                alert('Failed to delete task. Check network connection.');
                button.disabled = false;
                button.innerHTML = originalContent;
             }
              // Note: For skipped confirmation errors, we don't restore the button state here.
        }
        // Button state is handled implicitly or in error handlers above.
    }
    // --- End Section 6 ---


    // --- SECTION 7: General Motivation Handling ---
    async function triggerGeneralMotivation() {
        // ... (function content as before) ...
         const modalInstance = bootstrap.Modal.getOrCreateInstance(aiModalElement);

        if (modalTitleSpan) modalTitleSpan.textContent = 'Getting Motivation...';
        if (modalBody) modalBody.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        modalInstance.show();

        const originalButtonHTML = globalMotivateButton ? globalMotivateButton.innerHTML : null;
        if(globalMotivateButton) {
             globalMotivateButton.disabled = true;
             globalMotivateButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Thinking...`;
        }

        try {
            const response = await fetch('/motivate-me', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            if (modalTitleSpan) modalTitleSpan.textContent = 'A Dose of Motivation!';
            if (modalBody) {
                 modalBody.innerHTML = `
                    <blockquote class="blockquote mb-0">
                        <p>${escapeHTML(result.motivation)}</p>
                    </blockquote>
                 `;
            }
        } catch (error) {
            console.error('Error fetching motivation:', error);
            if (modalTitleSpan) modalTitleSpan.textContent = 'Error';
            if (modalBody) modalBody.textContent = `Sorry, couldn't get motivation: ${error.message}`;
        } finally {
             if(globalMotivateButton && originalButtonHTML) {
                 globalMotivateButton.disabled = false;
                 globalMotivateButton.innerHTML = originalButtonHTML;
            }
        }
    }

    if (globalMotivateButton) {
        globalMotivateButton.addEventListener('click', triggerGeneralMotivation);
    } else {
        console.log("Global motivate button (#global-motivate-button) not found. Motivation only available via voice command.");
    }

    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
        // ... (function content as before) ...
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
        modalTitleSpan.textContent = title;
        if (isOk) {
            modalBody.innerHTML = escapeHTML(result[responseKey] || "Received empty response from AI.").replace(/\n/g, '<br>');
        } else {
            modalBody.textContent = `${errorPrefix} ${result.error || 'Unknown server error'}`;
        }
        aiModal.show();
    }

    // --- (Add this maybe after Section 7 or near other handlers) ---
// --- SECTION: Speech Synthesis (Reading Tasks) ---

// Check for SpeechSynthesis support once upfront
const supportsSpeechSynthesis = 'speechSynthesis' in window;

if (!supportsSpeechSynthesis) {
    console.warn("Browser does not support Speech Synthesis (reading aloud).");
    // Optionally disable any UI elements related to reading tasks if they existed
}

function readTasksAloud() {
    if (!supportsSpeechSynthesis) {
        console.log("Speech synthesis not supported, cannot read tasks.");
        // Provide feedback to user? Maybe alert or temporary message?
        alert("Sorry, your browser cannot read tasks aloud.");
        return;
    }

    if (!taskList) {
        console.error("Task list element not found, cannot read tasks.");
        return;
    }

    const taskItems = taskList.querySelectorAll('li.task-item');
    let textToSpeak = "";
    let taskCount = 0;

    if (taskItems.length === 0) {
        textToSpeak = "You have no tasks.";
    } else {
        taskCount = taskItems.length;
        let tasksStrings = [];
        taskItems.forEach((item, index) => {
            const taskTextElement = item.querySelector('.task-text');
            const isCompleted = item.classList.contains('task-completed');
            if (taskTextElement) {
                // Include completion status in reading
                const statusPrefix = isCompleted ? "Completed: " : "";
                // Optionally add numbering: `Task ${index + 1}. ${statusPrefix}${taskTextElement.textContent}.`
                 tasksStrings.push(`${statusPrefix}${taskTextElement.textContent}.`);
            }
        });
        const plural = taskCount === 1 ? "task" : "tasks";
        textToSpeak = `Okay, you have ${taskCount} ${plural}. ${tasksStrings.join(' ')}`;
    }

    console.log("Attempting to speak:", textToSpeak);

    // Cancel any previous speech first
    window.speechSynthesis.cancel();

    // Create an utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Optional: Configure voice, rate, pitch
     utterance.lang = 'en-US'; // Match recognition language
     utterance.rate = 1.0;     // Default speed
     utterance.pitch = 1.0;    // Default pitch
    // Find available voices (might be async, using default is safer initially)
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices[/* desired index */];

     utterance.onstart = () => {
        console.log("SpeechSynthesis starting...");
        // Optional: Update UI to show speaking state? e.g., voice button icon
        // updateVoiceButtonState('speaking'); // Need to define this state
     };

     utterance.onend = () => {
         console.log("SpeechSynthesis finished.");
         // Optional: Reset UI state if changed onstart
         // If triggered by voice command, recognition.onend handles voice button reset
     };

     utterance.onerror = (event) => {
         console.error("SpeechSynthesis Error:", event.error);
         alert(`Sorry, there was an error reading the tasks aloud: ${event.error}`);
     };

    // Speak the text
    window.speechSynthesis.speak(utterance);
}
// --- END SECTION ---

    // --- End Section 7 ---


    // --- SECTION 8: Initial UI Setup ---
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        // ... (function content as before) ...
        const listItem = checkbox.closest('.task-item');
        if (listItem) {
             listItem.classList.toggle('task-completed', checkbox.checked);
        }
    });
    if (taskList && taskList.children.length === 0 && noTasksMsg) {
         // ... (function content as before) ...
         noTasksMsg.style.display = 'block';
     } else if (noTasksMsg) {
        noTasksMsg.style.display = 'none';
     }
    // --- End Section 8 ---


    // --- SECTION 9: Theme Toggling Logic ---
    (function applyThemePreference() {
        // ... (function content as before) ...
         const currentStoredTheme = localStorage.getItem('theme');
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        let initialTheme = 'light';

        if (currentStoredTheme) {
            initialTheme = currentStoredTheme;
        } else if (prefersDarkScheme.matches) {
            initialTheme = 'dark';
        }

        const applyTheme = (theme) => {
            let buttonText = 'Dark Mode <i class="bi bi-moon-stars-fill"></i>';
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
                buttonText = 'Light Mode <i class="bi bi-sun-fill"></i>';
            } else {
                document.documentElement.removeAttribute('data-bs-theme');
            }
            if(themeToggleButton) themeToggleButton.innerHTML = buttonText;
        };

        applyTheme(initialTheme);

        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', () => {
                let currentTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
                let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                localStorage.setItem('theme', newTheme);
            });
        } else {
            console.warn("Theme toggle button (#theme-toggle-btn) not found!");
        }
    })();
    // --- End Section 9 ---


    // --- SECTION 10: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let recognitionActive = false;

    function updateVoiceButtonState(state) {
        // ... (function content as before) ...
         if (!voiceInputBtn) return;
         const icon = voiceInputBtn.querySelector('i');
         if (!icon) return;

         voiceInputBtn.disabled = (state !== 'idle');

        if (state === 'listening') {
             voiceInputBtn.classList.remove('btn-primary', 'btn-secondary');
             voiceInputBtn.classList.add('btn-danger');
             icon.className = 'bi bi-record-circle-fill';
             if(taskInput) taskInput.placeholder = "Listening...";
         } else if (state === 'processing') {
             voiceInputBtn.classList.remove('btn-primary', 'btn-danger');
             voiceInputBtn.classList.add('btn-secondary');
             icon.className = 'bi bi-hourglass-split';
              if(taskInput) taskInput.placeholder = "Processing voice input...";
         } else { // idle state
             voiceInputBtn.classList.remove('btn-danger', 'btn-secondary');
             voiceInputBtn.classList.add('btn-primary');
             icon.className = 'bi bi-mic-fill';
             if(taskInput) taskInput.placeholder = "What needs doing? Or use the mic!";
             recognitionActive = false;
         }
    }
    function resetVoiceButton() {
        updateVoiceButtonState('idle');
    }


    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        // ... (recognition setup as before) ...
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => {
                // ... (start logic as before) ...
                 if (recognitionActive) {
                     console.log("Recognition already active, stopping.");
                     recognition.stop();
                     return;
                 }
                try {
                    recognition.start();
                    recognitionActive = true;
                } catch(e) {
                    console.error("Voice recognition start error:", e);
                    alert("Could not start voice recognition. Is the microphone busy or blocked?");
                    resetVoiceButton();
                }
            });

            // --- Recognition Event Handlers ---
             recognition.onstart = () => {
                 console.log("Voice recognition started.");
                 updateVoiceButtonState('listening');
             };

            // UPDATED onresult with "Clear Completed"
            // UPDATED onresult with "Read Tasks" command
                       // UPDATED onresult with Logging
                       recognition.onresult = (event) => {
                        console.log("--- Voice Result Received ---"); // Mark the start
                        updateVoiceButtonState('processing'); // Processing the command
        
                        let transcript = "";
                        if (event.results && event.results.length > 0 && event.results[0].length > 0) {
                             transcript = event.results[0][0].transcript.trim();
                             // Log the RAW transcript before lowercasing
                             console.log('Raw Transcript:', `"${transcript}"`, 'Confidence:', event.results[0][0].confidence);
                        } else {
                             console.warn("Received result event with no transcript.");
                             return; // Reset happens in onend
                         }
        
                        if (transcript === "") {
                            console.log("Empty transcript received.");
                            if(taskInput) taskInput.placeholder = "Didn't catch that.";
                            return; // Reset happens in onend
                        }
        
                        const lowerCaseTranscript = transcript.toLowerCase();
                        // --- ADDED LOG: Log the exact string being checked ---
                        console.log('Checking Command against:', `"${lowerCaseTranscript}"`);
        
                        // --- Command Parsing Logic ---
                        if (lowerCaseTranscript.includes('motivate') || lowerCaseTranscript.includes('motivation')) {
                            // --- ADDED LOG ---
                            console.log(">>> Entering: Motivate block");
                            triggerGeneralMotivation();
                        }
                        else if (lowerCaseTranscript.includes('clear completed') || lowerCaseTranscript.includes('remove finished') || lowerCaseTranscript.includes('delete completed')) {
                             // --- ADDED LOG ---
                             console.log(">>> Entering: Clear Completed block");
                            if (!taskList) { console.error("Task list not found for clearing."); return; }
                            const completedTasks = taskList.querySelectorAll('li.task-item.task-completed');
                            if (completedTasks.length === 0) {
                                console.log("No completed tasks found to clear.");
                                if(taskInput) taskInput.placeholder = "No completed tasks to clear.";
                            } else {
                                 console.log(`Found ${completedTasks.length} completed tasks. Attempting to clear...`);
                                 let clearedCount = 0;
                                 completedTasks.forEach(li => { /* ... delete logic ... */
                                    const taskId = li.dataset.taskId;
                                    const deleteButton = li.querySelector('.delete-btn');
                                    if (taskId && deleteButton) {
                                        handleDeleteClick(deleteButton, taskId, true);
                                        clearedCount++;
                                    } else { console.warn(`Could not find taskId or delete button for completed task:`, li); }
                                });
                                 console.log(`Initiated clearing for ${clearedCount} tasks.`);
                                 if(taskInput) taskInput.placeholder = `Cleared ${clearedCount} completed tasks.`;
                             }
                        }
                        else if (
                            lowerCaseTranscript.includes('read tasks') || // Plural
                            lowerCaseTranscript.includes('read my tasks') || // Plural
                            lowerCaseTranscript.includes('what are my tasks') || // Plural
                            lowerCaseTranscript.includes('list tasks') // Plural
                            // ADDING Singular version just in case:
                            // lowerCaseTranscript.includes('read task') ||
                            // lowerCaseTranscript.includes('read my task')
                         ) {
                             // --- ADDED LOG ---
                            console.log(">>> Entering: Read Tasks block");
                            readTasksAloud();
                        }
                        // --- Add more commands here ---
                        else {
                             // --- ADDED LOG ---
                             console.log(">>> Entering: Default Add Task block");
                            // --- Default Action: Add Task ---
                            console.log("Voice Input Defaulting To: Adding Task - ", transcript);
                            submitNewTask(transcript);
                        }
                        console.log("--- Command Parsing Complete ---"); // Mark the end
                    }; // End of onresult

             recognition.onspeechend = () => {
                 // ... (logic as before) ...
                 console.log("Speech end detected.");
                 // Consider stopping recognition if needed, though onresult might fire first
                 // recognition.stop(); // Might be redundant if onresult fires reliably
             };

            recognition.onnomatch = () => {
                 // ... (logic as before) ...
                 console.warn("Speech not recognized (no match).");
                 if(taskInput) taskInput.placeholder = "Couldn't understand that.";
             };

            recognition.onerror = (event) => {
                // ... (logic as before) ...
                 console.error(`Speech Recognition Error: ${event.error}`);
                let msg = `Speech Error: ${event.error}`;
                if (event.error === 'no-speech') msg = "No speech detected.";
                else if (event.error === 'audio-capture') msg = "Microphone error.";
                else if (event.error === 'not-allowed') msg = "Microphone permission denied.";
                else if (event.error === 'network') msg = "Network error during recognition.";
                if(taskInput) taskInput.placeholder = msg;
                alert(msg + " Please check microphone/permissions.");
            };

            recognition.onend = () => {
                // ... (logic as before) ...
                 console.log("Voice recognition ended.");
                 // Always reset button state and flag when recognition fully stops
                 resetVoiceButton();
                 recognitionActive = false;
            };

        } else {
            console.warn("Voice input button (#voiceInputBtn) not found! Voice commands disabled.");
        }
    } else {
        // ... (API not supported logic as before) ...
         console.warn("SpeechRecognition API not supported by this browser.");
        if (voiceInputBtn) {
            voiceInputBtn.disabled = true;
            voiceInputBtn.title = "Voice input not supported by your browser";
            voiceInputBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
        }
    }
    // --- End Section 10 ---

}); // End of DOMContentLoaded listener