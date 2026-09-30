// All preparation and cleanup are inside the operation's ownership boundary.
class OperationGate {
  constructor() {
    this.busy = false;
    this.controller = null;
  }
  async run(work, finish = () => {}) {
    if (this.busy) throw Error("Ek kaam pehle se chal raha hai.");
    this.busy = true;
    this.controller = new AbortController();
    try {
      return await work(this.controller.signal);
    } finally {
      this.busy = false;
      this.controller = null;
      finish();
    }
  }
  cancel() {
    this.controller?.abort();
  }
}
module.exports = { OperationGate };
