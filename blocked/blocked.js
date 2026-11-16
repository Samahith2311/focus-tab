const LINES = [
  'The tab will still be there later. The work will not do itself.',
  'One thing at a time.',
  'You set this time aside for a reason.',
  'Short focused sessions add up.',
  'Finish the session first. Scroll after.',
  'Future you is counting on the next few minutes.'
];

const heading = document.getElementById('heading');
const remaining = document.getElementById('remaining');
const line = document.getElementById('line');
const endButton = document.getElementById('end');

line.textContent = LINES[Math.floor(Math.random() * LINES.length)];

let countdown;
async function render() {
  const { focus } = await browser.storage.local.get('focus');
  clearInterval(countdown);
  remaining.hidden = endButton.hidden = !focus;
  if (!focus) {
    heading.textContent = 'Focus session over';
    line.textContent = 'This site is open again. You can go back to it now.';
    return;
  }
  const tick = () => { remaining.textContent = formatRemaining(focus.endTime - Date.now()); };
  tick();
  countdown = setInterval(tick, 1000);
}

endButton.addEventListener('click', () => browser.runtime.sendMessage({ type: 'stop' }));
browser.storage.onChanged.addListener(changes => { if (changes.focus) render(); });
render();
