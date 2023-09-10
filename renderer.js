const { ipcRenderer } = require('electron');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
console.log('ffmpeg path: ', ffmpeg, ffmpegPath)

const videoPlayer = document.getElementById('videoPlayer');
const videoInput = document.getElementById('videoInput');
const noteTextarea = document.getElementById('noteTextarea');
const noteListElement = document.getElementById('noteList');
const paginationPrevButton = document.getElementById('paginationPrev');
const paginationNextButton = document.getElementById('paginationNext');
const showNotesButton = document.getElementById('showNotesBtn');
const saveSRTButton = document.getElementById('saveSRT');
const uploadFileInput = document.getElementById('uploadFileInput');
const editModal = document.getElementById('editModal');
const editNoteTextarea = document.getElementById('editNoteTextarea');
const saveEditButton = document.getElementById('saveEditButton');
const closeButton = document.querySelector('.close');
const extractButton = document.getElementById('extractButton');
const extractionStatus = document.getElementById('extractionStatus');
const clipCheckboxes = [];
const searchInput = document.getElementById('searchInput');
// Add a reference to the time edit button
const editTimesButton = document.getElementById('editTimesBtn');

// Add an event listener for the edit times button
editTimesButton.addEventListener('click', () => {
  timeEditModal.style.display = 'block';
});
let editingNoteIndex = -1;

const noteList = [];
const notesPerPage = 5;
let currentPage = 0;
let videoFile

videoInput.addEventListener('change', async (event) => {
  videoFile = event.target.files[0];
  if (videoFile) {
    videoPlayer.src = URL.createObjectURL(videoFile);
    videoPlayer.load();
  }
  console.log('video name: ', videoFile.path)
});

videoPlayer.addEventListener('click', () => {
  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
});

let noteStartTime = null;

noteTextarea.addEventListener('keydown', (event) => {
  if (!noteStartTime) {
    noteStartTime = videoPlayer.currentTime;
  }
});

noteTextarea.addEventListener('keyup', (event) => {
  if (!noteStartTime) {
    return;
  }

  if (event.key === 'Enter') {
    const noteText = noteTextarea.value.trim();
    const noteEndTime = videoPlayer.currentTime;
    const note = {
      startTime: noteStartTime,
      endTime: noteEndTime,
      text: noteText,
    };

    ipcRenderer.send('addNote', note);
    noteList.push(note);

    noteTextarea.value = '';
    noteStartTime = null;
    
    console.log('Note:', note);
    console.log('Note Array:', noteList);
    updateNoteList(noteList);
  }
});

window.addEventListener('resize', () => {
  const { width, height } = videoPlayer.getBoundingClientRect();
  ipcRenderer.send('resize-window', { width, height });
});

// Function to update the note list
function updateNoteList(allNotes, searchQuery = '') {
  noteListElement.innerHTML = '';

  const filteredNotes = allNotes.filter(note =>
    note.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  filteredNotes.slice(currentPage * notesPerPage, (currentPage + 1) * notesPerPage).forEach((note, index) => {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'clip-checkbox';
    li.textContent = `${index + 1}. ${note.text}`;
    
    // Add an edit icon to each note
    const editIcon = document.createElement('i');
    editIcon.className = 'fas fa-edit edit-icon';
    editIcon.innerHTML = 'i'
    li.appendChild(editIcon);
    li.appendChild(checkbox);
    noteListElement.appendChild(li);
    clipCheckboxes.push(checkbox);
    console.log('element check: ', clipCheckboxes)
    
    li.addEventListener('click', () => {
      videoPlayer.currentTime = note.startTime;
    });
  });
  
  updatePaginationButtons(filteredNotes);

  // Update the note count
  const noteCountElement = document.getElementById('noteCount');
  noteCountElement.textContent = `Total Notes: ${filteredNotes.length}`;

  console.log('Updated noteList:', noteList , clipCheckboxes)
}

// Search input to track changes and trigger note list update
searchInput.addEventListener('input', (event) => {
  const searchQuery = event.target.value;
  updateNoteList(noteList, searchQuery);
});

// Event listener for the edit icon
noteListElement.addEventListener('click', (event) => {
  if (event.target.classList.contains('edit-icon')) {
    const li = event.target.parentElement;
    const noteIndex = Array.from(noteListElement.children).indexOf(li);
    handleEditNoteText(noteIndex);
  }
});

// Function to handle editing note text
function handleEditNoteText(noteIndex) {
  editingNoteIndex = noteIndex;
  const note = noteList[noteIndex];
  editNoteTextarea.value = note.text;
  editModal.style.display = 'block';
}

// Event listener for the "Save Edit" button
saveEditButton.addEventListener('click', () => {
  if (editingNoteIndex >= 0) {
    noteList[editingNoteIndex].text = editNoteTextarea.value.trim();
    updateNoteList(noteList);
    editModal.style.display = 'none';
  }
});

// Close the edit modal when the close button is clicked
closeButton.addEventListener('click', () => {
  editModal.style.display = 'none';
});


// // Event listener for the "Show Notes" button MAYBE ADD IT BUT NOT SURE YET!
showNotesButton.addEventListener('click', () => {
  if (noteListElement.style.display === 'none') {
    noteListElement.style.display = 'block';
  } else {
    noteListElement.style.display = 'none';
  }
});

// Add event listeners to pagination buttons
paginationPrevButton.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    updateNoteList(noteList);
  }
});

paginationNextButton.addEventListener('click', () => {
  if ((currentPage + 1) * notesPerPage < noteList.length) {
    currentPage++;
    updateNoteList(noteList);
  }
});

// Function to update pagination buttons based on current page and notes length
function updatePaginationButtons(allNotes) {
  paginationPrevButton.disabled = currentPage === 0;
  paginationNextButton.disabled = (currentPage + 1) * notesPerPage >= allNotes.length;
}

// Event listener for the "Save" button
saveSRTButton.addEventListener('click', () => {
  if (noteList.length === 0) {
    console.log('No notes to save.');
    return;
  }

  const fileName = getFileNameFromVideo(videoPlayer.src);
  const srtContent = generateSRTContent(noteList);

  saveSRTFile(fileName, srtContent);
  // saveSRTFile(srtContent);
});

// Function to extract the file name from video URL
function getFileNameFromVideo(videoURL) {
  const videoPath = new URL(videoURL).pathname;
  return path.basename(videoPath, path.extname(videoPath)) + '.srt';
}

// Function to generate SRT content from the note list
function generateSRTContent(notes) {
  let srtContent = '';
  notes.forEach((note, index) => {
    const formattedStartTime = formatTime(note.startTime);
    const formattedEndTime = formatTime(note.endTime);
    srtContent += `${index + 1}\n${formattedStartTime} --> ${formattedEndTime}\n${note.text}\n\n`;
  });
  return srtContent;
}

// Function to save the SRT file
function saveSRTFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Function to format time in HH:MM:SS,mmm format
function formatTime(time) {
  // let beforeTime = time (only used to check time)
  let milliseconds = Math.floor((time % 1) * 1000);
  time = Math.floor(time);
  let seconds = Math.floor(time % 60);
  time = (time - seconds) / 60;
  let minutes = Math.floor(time % 60);
  let hours = Math.floor(time / 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// SRT parsing logic

function parseSRTContent(content) {
  const notes = [];
  const lines = content.trim().split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+$/.test(line)) {
      // Assume the next line contains the time range (HH:MM:SS,mmm --> HH:MM:SS,mmm)
      const timeRange = lines[++i].trim().split(' --> ');
      const startTime = parseTime(timeRange[0]);
      const endTime = parseTime(timeRange[1]);

      // Assume the next line(s) contain the note text
      let text = '';
      for (i++; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') {
          break; // Stop parsing when an empty line is encountered
        }
        text += line + ' ';
      }


      notes.push({ startTime, endTime, text: text.trim() });
    }
  }

  return notes;
}

function parseTime(timeString) {
  const timeComponents = timeString.split(/[,.:]/).map(Number);
  if (timeComponents.length >= 3) {
    const [hours, minutes, seconds, milliseconds] = timeComponents;
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  } else {
    return NaN; // Unable to parse the time
  }
}

// Converting srt/webvtt file to notelist

function convertFileContentToNotes(content, fileExtension) {
  let parsedNotes = []
  console.log('before: ', parsedNotes)
  if (fileExtension === '.srt') {
    return parseSRTContent(content);
  } else if (fileExtension === '.vtt') {
    return parseWebVTTContent(content);
  } 

  // Update the note list UI
  updateNoteList(noteList);

  return parsedNotes;

}

// Add an event listener to the uploadFileInput element
uploadFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  
  if (file) {
    const fileContent = await readFileContent(file);
    const fileExtension = path.extname(file.name).toLowerCase();
    
    const parsedNotes = convertFileContentToNotes(fileContent, fileExtension);
    
    console.log('Parsed notes:', parsedNotes);
    console.log('before update:', noteList)
    // Push each individual note object from parsedNotes to noteList
    for (let i = 0; i < parsedNotes.length; i++) {
    noteList.push(parsedNotes[i]);
}
     // Update the note list UI
    updateNoteList(noteList);
    console.log('after update:', noteList)
  }
});

// Add a reference to the time edit modal elements
const timeEditModal = document.getElementById('timeEditModal');
const timeAdjustmentInput = document.getElementById('timeAdjustment');
const applyTimeAdjustmentButton = document.getElementById('applyTimeAdjustment');

// Event listener for the "Apply" button in the time edit modal
applyTimeAdjustmentButton.addEventListener('click', () => {
  const timeAdjustment = parseInt(timeAdjustmentInput.value);
  
  if (!isNaN(timeAdjustment)) {
    if (timeAdjustment < -noteList[0].startTime) {
      // Prevent adjusting to negative start times
      alert('Adjustment too large to keep positive start times.');
      return;
    }
    
    // Update start and end times for each note
    noteList.forEach((note) => {
      const newStartTime = Math.max(note.startTime + timeAdjustment, 0);
      const newEndTime = Math.max(note.endTime + timeAdjustment, 0);
      
      note.startTime = newStartTime;
      note.endTime = newEndTime;
    });
    
    // Update the note list UI
    updateNoteList(noteList);
    timeEditModal.style.display = 'none';
    timeAdjustmentInput.value = ''
  }
});

// Extracting clip from video
async function extractAndMergeClips(selectedNotes) {
  extractionStatus.textContent = 'Extracting and merging clips...';

  const outputDir = path.join(__dirname, 'clips'); // Output directory in the same folder as the script

  const promises = selectedNotes.map(note => {
    const startTime = note.startTime.toFixed(4); // Limit to 4 decimal places
    const endTime = note.endTime.toFixed(4); // Limit to 4 decimal places
    const outputFilePath = path.join(outputDir, `clip_${startTime}_${endTime}.mp4`);
    console.log('outputFilePath: ', outputFilePath, outputDir)

    return new Promise((resolve, reject) => {
      ffmpeg(videoFile.path) // Use the original video file path or URL here
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .output(outputFilePath)
        .on('end', resolve)
        .on('error', (err) => {
          reject(err); // Reject with the actual error
        })
        .run();
    });
  });

  try {
    await Promise.all(promises);
    extractionStatus.textContent = 'Clips extracted and merged.';
  } catch (error) {
    extractionStatus.textContent = `Error during extraction and merging: ${error.message}`;
    console.log(error.message)
  }

  // Clear the checkboxes after extraction
  clipCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
}


// Extract button 
extractButton.addEventListener('click', () => {
  const selectedNotes = [];
  clipCheckboxes.forEach((checkbox, index) => {
    if (checkbox.checked) {
      selectedNotes.push(noteList[index]);
    }
  });
  
  if (selectedNotes.length === 0) {
    extractionStatus.textContent = 'No clips selected for extraction.';
  } else {
    extractAndMergeClips(selectedNotes);
  }
});


// Function to read file content asynchronously
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file);
  });
}

ipcRenderer.on('videoPath', (_, videoPath) => {
  videoPlayer.src = videoPath;
});