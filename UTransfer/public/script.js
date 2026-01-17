const socket = io();

// DOM elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const pinInput = document.getElementById("pinInput");
const nicknameInput = document.getElementById("nickname");
const fileList = document.getElementById("fileList");

// --- Drag & Drop Zone ---
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    handleUpload(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", e => {
  if (e.target.files.length > 0) {
    handleUpload(e.target.files[0]);
  }
});

// --- Upload Function (with progress) ---
function handleUpload(file) {
  const pin = pinInput.value.trim();
  const nickname = nicknameInput.value.trim();

  if (!file || !pin) {
    alert("Create PIN");
    return;
  }

  // create a temporary upload item so user sees progress immediately
  const id = "upload-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const li = document.createElement("li");
  li.className = "file-item upload-item";
  li.id = id;
  li.innerHTML = `
    <span>
      <b>${escapeHtml(file.name)}</b> (${(file.size/1024).toFixed(1)} KB) <em class="upload-status">Uploading...</em>
    </span>
    <span class="progress-wrap">
      <div class="progress-container"><div class="progress-bar" style="width:0%">0%</div></div>
      <button class="cancel-btn">Cancel</button>
    </span>
  `;

  // insert at top so it's visible immediately
  fileList.insertBefore(li, fileList.firstChild);

  const progressBar = li.querySelector('.progress-bar');
  const statusEl = li.querySelector('.upload-status');
  const cancelBtn = li.querySelector('.cancel-btn');

  const formData = new FormData();
  formData.append("file", file);
  formData.append("pin", pin);
  formData.append("nickname", nickname);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload", true);

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + "%";
      progressBar.textContent = percent + "%";
    }
  };

  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
        if (data && data.success) {
          progressBar.style.width = '100%';
          progressBar.textContent = '100%';
          statusEl.textContent = 'Uploaded';
          // server will emit update; remove the temporary item shortly
          setTimeout(() => { if (li && li.parentNode) li.remove(); }, 1000);
        } else {
          statusEl.textContent = 'Failed';
          alert('Upload failed: ' + (data.error || xhr.statusText || 'Unknown'));
          if (li && li.parentNode) li.remove();
        }
      } else {
        statusEl.textContent = 'Failed';
        alert('Upload failed: ' + xhr.status + ' ' + xhr.statusText);
        if (li && li.parentNode) li.remove();
      }
    }
  };

  // wire cancel
  cancelBtn.onclick = () => {
    try { xhr.abort(); } catch (e) {}
    if (li && li.parentNode) li.remove();
  };

  // keep reference so other code could cancel if needed
  li._xhr = xhr;

  xhr.send(formData);
}

// allow cancel from global scope if needed
window.cancelUpload = id => {
  const el = document.getElementById(id);
  if (!el) return;
  try { el._xhr && el._xhr.abort(); } catch (e) {}
  if (el.parentNode) el.parentNode.removeChild(el);
};

// --- Escape HTML (for safe rendering) ---
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function renderFiles(files) {
  // Preserve any ongoing upload items so progress doesn't disappear mid-upload
  const ongoing = Array.from(fileList.querySelectorAll('.upload-item'));
  fileList.innerHTML = ""; // clear all and re-add ongoing first
  ongoing.forEach(n => fileList.appendChild(n));

  files.forEach((f, idx) => {
    const stored = f.stored;
    const nameEnc = encodeURIComponent(f.name);
    const nicknamePart = f.nickname ? ` -${escapeHtml(f.nickname)}` : "";

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
      <span>
        <b>${escapeHtml(f.name)}</b> (${(f.size/1024).toFixed(1)} KB)${nicknamePart}
      </span>
      <span>
        <button onclick="showInfo(${idx})">Info</button>
        <button onclick="downloadFile('${stored}', '${nameEnc}')">Download</button>
        <button onclick="deleteFile('${stored}')">Delete</button>
      </span>
    `;
    fileList.appendChild(li);
  });

  // Save latest files globally so info popup can use them
  window.latestFiles = files;
}

// --- Real-time updates from server ---
socket.on("update", files => {
  renderFiles(files);
});

// --- Download with PIN ---
async function downloadFile(stored, originalNameEncoded) {
  const originalName = decodeURIComponent(originalNameEncoded);
  const pin = prompt("Enter PIN to download:");
  if (!pin) return;

  try {
    const res = await fetch("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: stored, pin })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      alert(err.error || "Download failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Download error");
  }
}

// --- Delete with PIN ---
async function deleteFile(stored) {
  const pin = prompt("Enter PIN to delete:");
  if (!pin) return;

  const res = await fetch("/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: stored, pin })
  });

  const data = await res.json();
  if (!data.success) alert(data.error || "Delete failed");
}


// Show file info modal
function showInfo(index) {
  const f = window.latestFiles[index];
  const details = document.getElementById("infoDetails");
  details.innerHTML = `
    <li><b>Name:</b> ${escapeHtml(f.name)}</li>
    <li><b>Size:</b> ${(f.size/1024).toFixed(2)} KB</li>
    <li><b>Device:</b> ${escapeHtml(f.device)}</li>
    <li><b>Nickname:</b> ${escapeHtml(f.nickname || "—")}</li>
    <li><b>Time:</b> ${new Date(f.time).toLocaleString()}</li>
  `;

  document.getElementById("infoModal").style.display = "block";
}

// Modal close logic
document.getElementById("closeModal").onclick = () => {
  document.getElementById("infoModal").style.display = "none";
};
window.onclick = e => {
  if (e.target === document.getElementById("infoModal")) {
    document.getElementById("infoModal").style.display = "none";
  }
};
