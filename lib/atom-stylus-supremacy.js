'use babel';

import { createFormattingOptions, createFormattingOptionsFromStylint, format } from 'stylus-supremacy'

import AtomStylusSupremacyView from './atom-stylus-supremacy-view';
import { CompositeDisposable } from 'atom';
import fs from 'fs'
import path from 'path'

export default {

  atomStylusSupremacyView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.atomStylusSupremacyView = new AtomStylusSupremacyView(state.atomStylusSupremacyViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomStylusSupremacyView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-stylus-supremacy:toggle': () => this.toggle(),
      'atom-stylus-supremacy:fix-file': async () => {
        const textEditor = atom.workspace.getActiveTextEditor();
        if (!textEditor || textEditor.isModified()) {
          atom.notifications.addError('Stylus supremacy: Please save before fixing this file.')
          return
        }
        const [ projectPath, filePath ] = atom.project.relativizePath(textEditor.getPath())
        const pathArray = (path.sep + filePath).split(path.sep)
                                  .slice(0, -1)
        const rulesPath = pathArray.reduce(result => {
          const currentPath = path.join(projectPath, ...result, '.stylintrc')
          if (fs.existsSync(currentPath)) {
            return [...result, '.stylintrc']
          }
          return result.slice(0, -1)
        }, pathArray).join(path.sep)

        const content = textEditor.getText()
        const stylintRules = JSON.parse(
          fs.readFileSync(path.join(projectPath, rulesPath), 'utf8')
        )

        const formattingOptions = createFormattingOptionsFromStylint(stylintRules)
        const result = format(content, formattingOptions)
        console.log(result)
      }
    }));
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
  },

  toggle() {
    console.log('AtomStylusSupremacy was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
