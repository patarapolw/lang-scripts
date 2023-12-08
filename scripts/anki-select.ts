import { AnkiConnect } from '@/ankiconnect';
import { Direction, QBoxLayout, QPushButton, QWidget } from '@nodegui/nodegui';

const ankiConnect = new AnkiConnect('http://0.0.0.0:8765');

const sel = {
  Meaning:
    'deck:Yomichan* -deck:Yomichan-Meaning card:Meaning (added:1 OR -is:suspended) -tag:duplicate -tag:later -Reading:',
  Reading:
    'deck:Yomichan* -deck:Yomichan-Reading card:Reading (-is:suspended OR edited:1)',
  Writing:
    'deck:Yomichan* -deck:Yomichan-Writing card:Writing (-is:suspended OR edited:1)',
  noAudio: 'deck:Yomichan::Terms JapaneseAudio: -is:suspended -tag:no-audio',
  furiganaNotLearned: 'deck:Yomichan::Terms::Read JapaneseUsual:*]* Typing:',
};

async function doSelect(query: string) {
  return ankiConnect.send('guiBrowse', { query });
}

if (require.main === module) {
  const win = new QWidget();
  const layout = new QBoxLayout(Direction.TopToBottom);
  win.setLayout(layout);

  for (const [k, v] of Object.entries(sel)) {
    const btn = new QPushButton();
    btn.setText(k);
    btn.addEventListener('clicked', () => {
      doSelect(v);
    });

    layout.addWidget(btn);
  }

  win.show();

  Object.assign(global, { win });
}
