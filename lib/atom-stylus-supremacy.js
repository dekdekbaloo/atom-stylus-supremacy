'use babel';

import { createFormattingOptions, createFormattingOptionsFromStylint, format } from 'stylus-supremacy'

import { CompositeDisposable } from 'atom'
import fs from 'fs'
import path from 'path'
import JSONWithComments from 'comment-json'

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
  const { rulesDir, found } = pathArray.reduce(result => {
    const { rulesDir, found } = result
    const currentPath = path.join(projectPath, ...rulesDir, '.stylintrc')
    if (found || fs.existsSync(currentPath)) {
      return { rulesDir, found: true }
    }
    return { rulesDir: rulesDir.slice(0, -1), found: false }
  }, { rulesDir: pathArray, found: false })
  if (!found) return
  const rules = JSONWithComments.parse(
    fs.readFileSync(path.join(projectPath, ...rulesDir, '.stylintrc'), 'utf8'),
    null, true /* Strip comments */
  )
  return createFormattingOptionsFromStylint(rules)
}
function getFormattedStylusText (textEditor) {
  const formattingOptions = getStylintOptionsFromFile(textEditor)
  const content = textEditor.getText()
  return format(content, formattingOptions)
}

export default {
  modalPanel: null,
  subscriptions: null,

  config: {
    formatOnSave: {
      type: 'boolean',
      default: false,
      description: 'Let this package fix your stylus file on save.'
    }
  },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-stylus-supremacy:format-stylus': async () => {
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
        if (atom.config.get('atom-stylus-supremacy.formatOnSave') && isStylus(textEditor)) {
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
  },

  serialize() {
    return {}
  }
}
