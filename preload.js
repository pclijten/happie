const { contextBridge, ipcRenderer } = require("electron");
const call = (name) => (...a) => ipcRenderer.invoke(name, ...a);
contextBridge.exposeInMainWorld("hap", {
  state: call("state"), chooseFolder: call("choose-folder"),
  unlock: call("unlock"), lock: call("lock"), setPin: call("set-pin"),
  op: call("op"),
  attachFile: call("attach-file"), attachLink: call("attach-link"), attachRemove: call("attach-remove"),
  attachOpen: call("attach-open"), attachSaveAs: call("attach-save-as"),
  protoState: call("proto-state"), protoOp: call("proto-op"), protoPick: call("proto-pick-file"), protoOpen: call("proto-open"), protoConfirm: call("proto-confirm"),
  protoEditStart: call("proto-edit-start"), protoEditFinish: call("proto-edit-finish"), protoEditCancel: call("proto-edit-cancel"),
  copy: call("clipboard"), autostart: call("autostart"),
  onChanged: (cb) => ipcRenderer.on("data-changed", (_e, d) => cb(d))
});
