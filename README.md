UTransfer is a simple app to transfer files over your WIFI with advanced encryption and PINs. 

Live at utransfer.onrender.com


## Tests
No test suite is included in the repository.


## API reference
- **POST /upload** – multipart form data with fields `file` (binary), `pin` (string, required), `nickname` (optional). Returns JSON with file metadata.
- **POST /download** – JSON body `{ "filename": "<stored name>", "pin": "<PIN>" }`. Returns the file as a download if PIN matches.
- **POST /delete** – JSON body (implementation incomplete in source).


## Code example
```javascript
function handleUpload(file) {
  const pin = pinInput.value.trim();
  const nickname = nicknameInput.value.trim();
  if (!file || !pin) { alert("Create PIN"); return; }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pin", pin);
  formData.append("nickname", nickname);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload", true);
  // progress handling omitted for brevity
  xhr.send(formData);
}
```


## Screenshots
*No screenshots are provided in the repository.*


## Code style
The code follows modern ES6 JavaScript conventions: `const`/`let`, arrow functions, template literals, and consistent indentation. No explicit linting configuration is present.


## Build status
No CI badge is defined. To build and verify the project, install Node.js, ensure required packages are installed, and run `node server.js` to start the server.


## Usage
```bash
# Start the server (requires Node.js)
node server.js
```
Then open a web browser and navigate to `http://localhost:5000` (or the deployed URL) to access the UI.


## Installation
No installation steps are provided in the repository manifest. The project relies on standard Node.js dependencies which can be installed manually if a `package.json` were present.


## Features
- Drag‑and‑drop or file‑picker upload UI
- PIN protection for each uploaded file
- Optional nickname to identify the uploading device
- Real‑time file list updates via Socket.io
- Upload progress bar with cancel support
- Automatic file expiration after 10 minutes
- Download endpoint that validates PIN
- Delete endpoint (implementation stub)


## Tech/framework used
- Node.js runtime
- Express – web server framework
- Socket.io – real‑time communication between server and browser
- Multer – handling multipart file uploads
- Axios – HTTP client (used in server code)
- Native `fs`, `path`, `os` modules
- Front‑end JavaScript with plain HTML/CSS (drag‑and‑drop UI)


## Motivation
UTransfer exists to provide a lightweight way to transfer files over a local Wi‑Fi network, protecting transfers with optional PINs and device nicknames, and automatically expiring files after a short period.

---

*Created with [repo-doctor](https://prathamjain.com/projects/repo-doctor)*
