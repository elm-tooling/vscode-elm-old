# Elm support for Visual Studio Code

![Error highlighting](images/errorHighlighting.gif)

## Feature overview

* Syntax highlighting
* Autocomplete (for external packages and experimental for local project)
* Error highlighting
* Code formatting
* Hover info
* Document Symbol provider
* Integration with Elm Package
* Integration with Elm Reactor
* Integration with Elm Make
* REPL
* Custom Elm Snippets

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

### Function information

![Function info](images/functionInfo.gif)

You can hover over a function and get the signature and comment.

### REPL

![REPL](images/repl.gif)

Not sure about the output of a function? Test it from inside the editor.

Open the actions menu and use one of the following commands:

* Elm: REPL - Start
* Elm: REPL - Send Line
* Elm: REPL - Send Selection
* Elm: REPL - Send File


### Reactor support

![Reactor support](images/reactor.gif)

Reactor is the webserver which comes with Elm.

* Reactor allows recompiling on-the-fly.
* Reactor contains the [Time-traveling debugger](http://debug.elm-lang.org/).

We support starting / stopping from within the editor.

### Snippets

We support snippets for the basic language features. To use them, press `Ctrl+Space` and start typing.
Or start with some characters and use `Ctrl+Space` for autocompletion.

Want to know more? Look at the [snippet definitions](snippets/elm.json)

### Format

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

The project is hosted on [GitHub]https://github.com/Krzysztof-Cieslak/vscode-elm/) where you can [report issues](https://github.com/Krzysztof-Cieslak/vscode-elm/issues), fork
the project and submit pull requests.

The library is available under [MIT license](https://github.com/Krzysztof-Cieslak/vscode-elm/blob/master/LICENSE.md), which allows modification and redistribution for both commercial and non-commercial purposes.

## Maintainer(s)

* Krzysztof Cieslak [@Krzysztof-Cieslak](https://github.com/Krzysztof-Cieslak)
* Sascha Brink [@sbrink](https://github.com/sbrink)
* Robert Jeppesen [@rojepp](https://github.com/rojepp)