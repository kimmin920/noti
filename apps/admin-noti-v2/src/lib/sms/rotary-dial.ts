type RotaryDialOptions = {
  mount: HTMLElement;
  size?: number;
  discFillColor?: string;
  discStrokeColor?: string;
  circlesFillColor?: string;
  circlesStrokeColor?: string;
  circlesHighlightColor?: string;
  textFillColor?: string;
  textStrokeColor?: string;
  arrowFillColor?: string;
  arrowStrokeColor?: string;
  callback?: (number: number) => void;
};

// Adapted from victorqribeiro/dial (MIT) for React mounting/lifecycle.
export class RotaryDial {
  private canvasSize: number;
  private size: number;
  private discFillColor: string;
  private discStrokeColor: string;
  private circlesFillColor: string;
  private circlesStrokeColor: string;
  private circlesHighlightColor: string;
  private textFillColor: string;
  private textStrokeColor: string;
  private arrowFillColor: string;
  private arrowStrokeColor: string;
  private mount: HTMLElement;
  private callback: (number: number) => void;

  private canvas: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private w: number;
  private h: number;
  private w2: number;
  private h2: number;
  private readonly TWOPI = Math.PI * 2;
  private offset: number;
  private outerCircle: number;
  private innerCircle: number;

  private a = 1;
  private clicking = false;
  private number: number | null = null;
  private lastAngle = 0;
  private newAngle = 0;
  private rafId: number | null = null;

  private readonly handleMouseDown: (event: MouseEvent) => void;
  private readonly handleMouseUp: () => void;
  private readonly handleMouseOut: () => void;
  private readonly handleMouseMove: (event: MouseEvent) => void;
  private readonly handleTouchStart: (event: TouchEvent) => void;
  private readonly handleTouchMove: (event: TouchEvent) => void;
  private readonly handleTouchEnd: () => void;
  private readonly handleTouchCancel: () => void;

  constructor({
    mount,
    size,
    discFillColor,
    discStrokeColor,
    circlesFillColor,
    circlesStrokeColor,
    circlesHighlightColor,
    textFillColor,
    textStrokeColor,
    arrowFillColor,
    arrowStrokeColor,
    callback,
  }: RotaryDialOptions) {
    this.mount = mount;
    this.canvasSize = size || 400;
    this.size = this.canvasSize - 2;
    this.discFillColor = discFillColor || "transparent";
    this.discStrokeColor = discStrokeColor || "black";
    this.circlesFillColor = circlesFillColor || "black";
    this.circlesStrokeColor = circlesStrokeColor || "transparent";
    this.circlesHighlightColor = circlesHighlightColor || "red";
    this.textFillColor = textFillColor || "white";
    this.textStrokeColor = textStrokeColor || "transparent";
    this.arrowFillColor = arrowFillColor || "black";
    this.arrowStrokeColor = arrowStrokeColor || "transparent";
    this.callback = callback || console.log;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w = this.canvasSize;
    this.canvas.height = this.h = this.canvasSize;
    this.canvas.className = "sms-rotary-canvas";
    this.canvas.setAttribute("aria-hidden", "true");

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("RotaryDial canvas context is not available.");
    }

    this.c = context;
    this.w2 = this.w / 2;
    this.h2 = this.h / 2;
    this.offset = this.size * 0.25;
    this.outerCircle = this.size / 2;
    this.innerCircle = this.outerCircle - this.offset;
    this.c.font = `${this.size * 0.08}px Arial`;
    this.c.textAlign = "center";

    this.handleMouseDown = (event) => this.isClicking(event);
    this.handleMouseUp = () => this.result();
    this.handleMouseOut = () => this.clear();
    this.handleMouseMove = (event) => this.rotate(event);
    this.handleTouchStart = (event) => this.isClicking(event);
    this.handleTouchMove = (event) => this.rotate(event);
    this.handleTouchEnd = () => this.result();
    this.handleTouchCancel = () => this.clear();

    this.mount.innerHTML = "";
    this.mount.appendChild(this.canvas);
    this.draw();
    this.addEvents();
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("mouseout", this.handleMouseOut);
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("touchmove", this.handleTouchMove);
    window.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("touchcancel", this.handleTouchCancel);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.canvas.parentElement === this.mount) {
      this.mount.removeChild(this.canvas);
    }
  }

  private draw() {
    this.c.clearRect(0, 0, this.w, this.h);

    this.c.beginPath();
    this.c.arc(this.w2, this.h2, this.outerCircle, 0, this.TWOPI, false);
    this.c.moveTo(this.w2 + this.innerCircle, this.h2);
    this.c.arc(this.w2, this.h2, this.innerCircle, this.TWOPI, 0, true);
    this.c.fillStyle = this.discFillColor;
    this.c.fill();
    this.c.strokeStyle = this.discStrokeColor;
    this.c.lineWidth = Math.max(2, this.size * 0.01);
    this.c.stroke();

    this.c.save();
    this.c.translate(this.w2, this.h2);

    for (let i = 0; i < 10; i += 1) {
      const a = this.a + i / 2;
      const center = this.innerCircle + (this.outerCircle - this.innerCircle) / 2;
      const x = Math.cos(a) * center;
      const y = Math.sin(a) * center;
      const n = (10 - i) % 10;

      this.c.beginPath();
      this.c.arc(x, y, this.size * 0.08, 0, this.TWOPI);
      this.c.fillStyle = this.circlesFillColor;
      this.c.strokeStyle = this.circlesStrokeColor;

      if (this.number !== null && this.number % 10 === n) {
        this.c.fillStyle = this.circlesHighlightColor;
      }

      this.c.fill();
      this.c.stroke();

      this.c.fillStyle = this.textFillColor;
      this.c.strokeStyle = this.textStrokeColor;
      this.c.fillText(String(n), x, y + this.size * 0.02);
      this.c.strokeText(String(n), x, y + this.size * 0.02);
    }

    this.c.restore();

    this.c.beginPath();
    this.c.moveTo(this.w - this.size * 0.08, this.h2);
    this.c.lineTo(this.w, this.h2 - this.size * 0.04);
    this.c.lineTo(this.w, this.h2 + this.size * 0.04);
    this.c.closePath();
    this.c.fillStyle = this.arrowFillColor;
    this.c.strokeStyle = this.arrowStrokeColor;
    this.c.fill();
    this.c.stroke();
  }

  private addEvents() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mouseout", this.handleMouseOut);
    this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    window.addEventListener("touchend", this.handleTouchEnd);
    window.addEventListener("touchcancel", this.handleTouchCancel);
  }

  private result() {
    if (this.number !== null) {
      this.callback(this.number % 10);
    }
    this.clear();
  }

  private isClicking(event: MouseEvent | TouchEvent) {
    event.preventDefault();

    const pos = this.getPos(event);
    const dist = this.getDist(pos.x, pos.y, this.w2, this.h2);

    if (dist > this.size / 2 || dist < this.size / 2 - this.offset) {
      return;
    }

    this.lastAngle = Math.atan2(pos.y - this.h2, pos.x - this.w2);
    this.number = null;
    this.clicking = true;
  }

  private getDist(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private getPos(event: MouseEvent | TouchEvent) {
    event.preventDefault();

    let x = 0;
    let y = 0;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    if ("touches" in event) {
      const touch = event.targetTouches[0] || event.changedTouches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = (event.clientX - rect.left) * scaleX;
      y = (event.clientY - rect.top) * scaleY;
    }

    return { x, y };
  }

  private clear() {
    this.number = null;
    this.clicking = false;
    this.goBack();
  }

  private rotate(event: MouseEvent | TouchEvent) {
    if (!this.clicking || this.a >= this.TWOPI) return;

    if (this.a < 1) {
      this.a = 1;
      return;
    }

    const pos = this.getPos(event);
    const dist = this.getDist(pos.x, pos.y, this.w2, this.h2);

    if (dist > this.size / 2 || dist < this.size / 2 - this.offset) {
      this.clear();
      return;
    }

    const n = Math.floor(((this.a - 1.1) / (this.TWOPI - 0.8)) * 11);
    this.number = n > 0 ? n : null;

    this.newAngle = Math.atan2(pos.y - this.h2, pos.x - this.w2);
    const delta = this.a - (this.lastAngle - this.newAngle);
    this.a = delta > 0 ? delta : this.TWOPI + delta;
    this.lastAngle = this.newAngle;
    this.draw();
  }

  private goBack() {
    if (this.a > 1) {
      this.a -= 0.1;
      this.draw();
      this.rafId = requestAnimationFrame(() => this.goBack());

      if (this.a - 1 < 0.05) {
        this.a = 1;
      }
    } else {
      this.rafId = null;
    }
  }
}
