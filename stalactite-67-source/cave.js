const AudioEngine = window.AudioContext || window.webkitAudioContext;
const notes = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23];
const keys = ["a", "s", "d", "f", "g", "h", "j"];
const strings = [...document.querySelectorAll(".string")];
const sceneLight = document.querySelector(".scene-light");
const listen = document.querySelector("#listen");
const sound = document.querySelector("#sound");
const soundLabel = document.querySelector("#sound-label");
const status = document.querySelector("#audio-status");

let audio;
let master;
let reverb;
let enabled = true;
let playing = false;
let ringTimer;
const stringTimers = new Map();

async function prepareAudio() {
  if (!enabled || !AudioEngine) return false;

  try {
    if (!audio) {
      audio = new AudioEngine();
      master = audio.createGain();
      master.gain.value = 0.58;
      master.connect(audio.destination);

      const length = Math.floor(audio.sampleRate * 2.6);
      const impulse = audio.createBuffer(2, length, audio.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const samples = impulse.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) {
          const decay = (1 - index / samples.length) ** 3.9;
          samples[index] = (Math.random() * 2 - 1) * decay;
        }
      }

      reverb = audio.createConvolver();
      reverb.buffer = impulse;
      const wet = audio.createGain();
      wet.gain.value = 0.24;
      reverb.connect(wet).connect(master);
    }

    if (audio.state !== "running") await audio.resume();
    status.textContent = "";
    return enabled && audio.state === "running";
  } catch {
    status.textContent = "无法播放声音。";
    return false;
  }
}

function playNote(index, delay = 0) {
  const now = audio.currentTime + delay + 0.008;
  const frequency = notes[index];
  const partials = [
    { ratio: 1, volume: 0.23, length: 1.8 },
    { ratio: 2, volume: 0.062, length: 0.9 },
    { ratio: 3.01, volume: 0.047, length: 0.47 },
    { ratio: 5.03, volume: 0.018, length: 0.24 },
  ];

  for (const { ratio, volume, length } of partials) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.frequency.value = frequency * ratio;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + 0.014);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + length);
    oscillator.connect(envelope);
    envelope.connect(master);
    envelope.connect(reverb);
    oscillator.start(now);
    oscillator.stop(now + length + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}

function flash(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function ring(index) {
  const string = strings[index];
  flash(string, "plucked");
  flash(sceneLight, "ringing");
  clearTimeout(stringTimers.get(index));
  clearTimeout(ringTimer);
  stringTimers.set(index, setTimeout(() => {
    string.classList.remove("plucked");
    stringTimers.delete(index);
  }, 750));
  ringTimer = setTimeout(() => sceneLight.classList.remove("ringing"), 1650);
}

function setSound(next) {
  enabled = next;
  sound.setAttribute("aria-pressed", String(enabled));
  soundLabel.textContent = enabled ? "声音开启" : "声音关闭";
  if (master) {
    const now = audio.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(enabled ? 0.58 : 0, now, 0.016);
  }
}

async function pluck(index) {
  ring(index);
  if (await prepareAudio()) playNote(index);
}

sound.addEventListener("click", () => {
  setSound(!enabled);
  if (enabled) void prepareAudio();
});

listen.addEventListener("click", async () => {
  if (playing) return;
  playing = true;
  listen.classList.add("is-playing");

  const theme = [{ index: 0, time: 0 }, { index: 3, time: 0.22 }, { index: 5, time: 0.47 }, { index: 6, time: 0.82 }];
  for (const { index, time } of theme) {
    setTimeout(() => ring(index), time * 1000);
  }
  setTimeout(() => {
    playing = false;
    listen.classList.remove("is-playing");
  }, 2300);

  if (await prepareAudio()) {
    for (const { index, time } of theme) playNote(index, time);
  }
});

for (const string of strings) {
  string.addEventListener("click", () => pluck(Number(string.dataset.note)));
}

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  const index = keys.indexOf(event.key.toLowerCase());
  if (index !== -1) pluck(index);
});

if (!AudioEngine) {
  setSound(false);
  soundLabel.textContent = "声音不可用";
  sound.disabled = true;
}
