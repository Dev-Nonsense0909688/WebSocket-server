<script>
  const ws = new WebSocket("wss://websocket-server-no6j.onrender.com");

  const loginBox = document.getElementById("login");
  const appBox = document.getElementById("app");
  const usernameInput = document.getElementById("username");
  const messageInput = document.getElementById("message");
  const chatBox = document.getElementById("chat");
  const receiverList = document.getElementById("receiverList");
  const receiverStatus = document.getElementById("receiverStatus");

  const dmBox = document.getElementById("dmBox");
  const dmTarget = document.getElementById("dmTarget");
  const dmMessage = document.getElementById("dmMessage");

  let usernameSet = false;
  let currentDMTarget = null;

  function append(msg) {
    chatBox.textContent += msg + "\n";
    chatBox.scrollTop = chatBox.scrollHeight;

    if (msg.startsWith("[Receivers Online]:")) {
      const rawList = msg.split(":")[1].trim();
      const list = rawList === "None" ? [] : rawList.split(",").map(x => x.trim());
      receiverStatus.textContent = `🟢 ${list.length} online`;

      receiverList.innerHTML = list.length
        ? list.map(name => `<div onclick="openDM('${name}')">${name}</div>`).join("")
        : "<div>No receivers online.</div>";
    }
  }

  function openDM(name) {
    currentDMTarget = name;
    dmTarget.textContent = "DMing: " + name;
    dmBox.classList.remove("hidden");
    dmMessage.focus();
  }

  function sendDM() {
    const msg = dmMessage.value.trim();
    if (!msg || !currentDMTarget || ws.readyState !== WebSocket.OPEN) return;

    ws.send(`/to ${currentDMTarget} ${msg}`);
    append(`[You → ${currentDMTarget}]: ${msg}`);
    dmMessage.value = "";
  }

  ws.onopen = () => {
    append("[System] Connected to server.");
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && usernameSet) {
        ws.send("/receivers");
      }
    }, 3000);
  };

  ws.onmessage = (e) => append(e.data);
  ws.onclose = () => append("[System] Disconnected from server.");
  ws.onerror = (e) => append("[Error] WebSocket error");

  function setUsername() {
    const name = usernameInput.value.trim();
    if (!name || ws.readyState !== WebSocket.OPEN) {
      append("[Error] WebSocket not ready or name empty.");
      return;
    }

    ws.send("/user " + name);
    usernameSet = true;

    loginBox.classList.add("hidden");
    appBox.classList.remove("hidden");
    append(`[System] You are now "${name}"`);
  }

  function sendMsg() {
    const msg = messageInput.value.trim();
    if (!msg || ws.readyState !== WebSocket.OPEN) return;

    ws.send(msg);
    messageInput.value = '';
  }
</script>
