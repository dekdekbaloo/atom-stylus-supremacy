'use babel';

import { createFormattingOptions, createFormattingOptionsFromStylint, format } from 'stylus-supremacy'

import AtomStylusSupremacyView from './atom-stylus-supremacy-view';
import { CompositeDisposable } from 'atom';
import fs from 'fs'
import path from 'path'

function isStylus (textEditor) {
  const { scopes } = textEditor.getRootScopeDescriptor()
  return /.stylus$/.test(scopes[0])
}

function getStylintOptionsFromFile (textEditor) {
  const [ projectPath, filePath ] = atom.project
                                      .relativizePath(textEditor.getPath())
  const pathArray = (path.sep + filePath)
                      .split(path.sep)
                      .slice(0, -1)
  const rulesPath = pathArray.reduce(result => {
    const currentPath = path.join(projectPath, ...result, '.stylintrc')
    if (fs.existsSync(currentPath)) {
      return [...result, '.stylintrc']
    }
    return result.slice(0, -1)
  }, pathArray).join(path.sep)
  if (!rulesPath) return
  const rules = JSON.parse(
    fs.readFileSync(path.join(projectPath, rulesPath), 'utf8')
  )
  return createFormattingOptionsFromStylint(rules)
}
function getFormattedStylusText (textEditor) {
  const formattingOptions = getStylintOptionsFromFile(textEditor)
  const content = textEditor.getText()
  return format(content, formattingOptions)
}

export default {

  atomStylusSupremacyView: null,
  modalPanel: null,
  subscriptions: null,

  config: {
    fixOnSave: {
      type: 'boolean',
      default: false,
      description: 'Let this package fix your stylus file on save.'
    }
  },

  activate(state) {
    this.atomStylusSupremacyView = new AtomStylusSupremacyView(state.atomStylusSupremacyViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomStylusSupremacyView.getElement(),
      visible: true
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-stylus-supremacy:fix-file': async () => {
        const textEditor = atom.workspace.getActiveTextEditor()
        if (!textEditor || textEditor.isModified()) {
          atom.notifications.addError('Stylus supremacy: Please save before fixing this file.')
          return
        }
        if (!isStylus(textEditor)) {
          atom.notifications.addError('Stylus supremacy: This is not a stylus file.')
          return
        }
        const cursorPosition = textEditor.getCursorBufferPosition()
        const formattedText = getFormattedStylusText(textEditor)
        textEditor.setText(formattedText)
        textEditor.setCursorBufferPosition(cursorPosition)
      }
    }));

    // Register text editor events
    this.subscriptions.add(atom.workspace.observeTextEditors((textEditor) => {
      textEditor.onDidSave(async ({ path }) => {
        if (atom.config.get('atom-stylus-supremacy.fixOnSave') && isStylus(textEditor)) {
          // When a stylus file is saved, we will replace the file with a formatted one.
          const formattedText = getFormattedStylusText(textEditor)
          fs.writeFileSync(path, formattedText)
        }
      })
    }))
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.atomStylusSupremacyView.destroy();
  },

  serialize() {
    return {
      atomStylusSupremacyViewState: this.atomStylusSupremacyView.serialize()
    };
  }
};
