# Elm support for Visual Studio Code

![Error highlighting](images/errorHighlighting.gif)

## Feature overview

* Syntax highlighting
* Autocomplete (for external packages and experimental for local project)
* Error highlighting
* Hover info
* Document Symbol provider (Go to definition, list and search symbols)
* Code Actions (Lightbulb on errors and warnings with fixes)
* Integration with Elm Package (Browse and install packages)
* REPL integration
* Integration with Elm Reactor
* Integration with Elm Make
* Custom Elm Snippets
* Code formatting with Elm-format

## Elm Installation

### Global Installation

Follow [this guide](https://guide.elm-lang.org/install.html).

### Project (Local) Installation

Run `npm install --save-dev elm`

Then, in `.vscode/settings.json`, add the following:

```
"elm.makeCommand": "./node_modules/.bin/elm-make"
```

## Feature details

### Syntax highlighting

Syntax highlighting is essential. The full language is supported. Can we improve the highlighting further? Please create an [issue](https://github.com/sbrink/vscode-elm/issues)!

### Error highlighting

![Error highlighting](images/errorHighlighting.gif)

We support error highlighting **on save**. If you check *Auto save* under File, you should get feedback immediately.

This is marked **experimental** because we still have to improve the project detection.
We'll solve this in the next days.

### Hover info - Function information

![Function info](images/functionInfo.gif)

You can hover over a function and get the signature and comment.

### Document and Workspace symbols

Use context menu "Go to definition" or F12. Alt+F12 to Peek
![Go to definition](images/gotoDefinition.gif)

Ctrl+Shift+O for document symbols and Ctrl+T for workspace symbols
![Search/browse document symbols and workspace symbols](images/searchDefinition.gif)

### Code Actions (Lightbulb on errors and warnings with fixes)

Tip - use Ctrl+. to invoke code action when the lightbulb is visible
![Code actions](images/codeActions.gif)

### Integration with Elm Package (Browse and install packages)

Ctrl+Shift+P - Elm browse packages
![Browse packages](images/browsePackages.gif)

Ctrl+Shift+P - Elm install package
![Install package](images/installPackage.gif)
### Local Project Intellisense (experimental)

vscode-elm will scan your projects to build intellisense results.
**Assumption** your files match the layout of elm-format
 
Example behaviors are:

* suggesting function names available in the current file or imported from your own modules
* suggesting module names you have imported in the current file
* suggesting union type or type alias names in function signatures
* suggesting possible values of a union type
* suggesting properties of a record. This requires that record is a parameter in the current function and the function has a type signature.

**important note regarding performance**

With `elm.userProjectImportStrategy` set to `"dynamicLookup"` (default), every hover or autocomplete action will trigger a scan of the first few lines of every file in your src directory (not the elm-stuff directory). This is done to establish an accurate list of module names but could be slow for exceptionally large projects. 

In testing with the Elm SPA example project no slowdown was noticed, but if your project slows down try one of these alternate settings:

* `"semiDynamicLookup"` - the above directory scan still takes place but only once, then the results are stored in memory.  Subsequent hover or autocomplete results will be instantaneous but the list of available modules will only update if the window is reloaded.
* `"dotIsFolder"` - this assumes that any module name with a `.` in it is contained in a folder. For example Page.Home would attempt to look for Home.elm inside of the \Page\ folder.
* `"dotIsFilenameCharacter"` - this setting does not attempt to create a directory structure for Page.Home and instead looks for a file named \Page.Home.elm
* `"ignore"` - do not attempt to look in imported modules for intellisense


### REPL integration

![REPL](images/repl.gif)

Not sure about the output of a function? Test it from inside the editor.

Open the actions menu and use one of the following commands:

* Elm: REPL - Start
* Elm: REPL - Stop
* Elm: REPL - Send Line
* Elm: REPL - Send Selection
* Elm: REPL - Send File

### Reactor integration

![Reactor support](images/reactor.gif)

Reactor is the webserver which comes with Elm.

* Reactor allows recompiling on-the-fly.
* Reactor contains the [Time-traveling debugger](http://debug.elm-lang.org/).

We support starting / stopping from within the editor.

### Integration with Elm Make

* Elm: Make
* Elm: Make --warn
* Make user setting to choose a fixed file to make

### Snippets

We support snippets for the basic language features. To use them, press `Ctrl+Space` and start typing.
Or start with some characters and use `Ctrl+Space` for autocompletion.

Want to know more? Look at the [snippet definitions](snippets/elm.json)

### Formatting with Elm-format

[elm-format](https://github.com/avh4/elm-format) is supported via the editor's `Format Code` command. To format your code using `elm-format`, press `Shift+Alt+F` on Windows, `Shift+Option+F` on Mac, or `Ctrl+Shift+I` on Linux.

You can also configure `elm-format` to run on save by enabling the `elm.formatOnSave` in your settings.

```
// settings.json
{
    "elm.formatOnSave": true
}
```

### Clean Build Artifacts

You can delete your `elm-stuff/build-artifacts` directly from vscode by using `Elm: Clean build artifacts` command.

## Help wanted

Building all these things will take some time. So pull requests are much appreciated!

## Acknowledgements

* Grammar file is taken and converted from [atom-elm](https://github.com/edubkendo/atom-elm).
* Initial snippets from [Elm.tmLanguage](https://github.com/deadfoxygrandpa/Elm.tmLanguage)

## Contributing and copyright

The project is hosted on [GitHub](https://github.com/Krzysztof-Cieslak/vscode-elm/) where you can [report issues](https://github.com/Krzysztof-Cieslak/vscode-elm/issues), fork
the project and submit pull requests.

The library is available under [MIT license](https://github.com/Krzysztof-Cieslak/vscode-elm/blob/master/LICENSE.md), which allows modification and redistribution for both commercial and non-commercial purposes.

## Maintainer(s)

* Krzysztof Cieslak [@Krzysztof-Cieslak](https://github.com/Krzysztof-Cieslak)
* Sascha Brink [@sbrink](https://github.com/sbrink)
* Robert Jeppesen [@rojepp](https://github.com/rojepp)
