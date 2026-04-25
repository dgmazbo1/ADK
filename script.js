const buildForm = document.querySelector(".build-form");
const formNote = document.querySelector(".form-note");

if (buildForm && formNote) {
  buildForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formNote.textContent =
      "Build request staged. Call ADK at (702) 810-9021 to connect this form to live intake.";
  });
}

const board = document.querySelector(".fabrication-board");

if (board) {
  board.addEventListener("pointermove", (event) => {
    const rect = board.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
    board.style.setProperty("--tilt-x", `${y}deg`);
    board.style.setProperty("--tilt-y", `${x}deg`);
  });

  board.addEventListener("pointerleave", () => {
    board.style.removeProperty("--tilt-x");
    board.style.removeProperty("--tilt-y");
  });
}

const labels = document.querySelectorAll(".tech-labels li");

labels.forEach((label, index) => {
  label.style.transitionDelay = `${index * 35}ms`;
});
