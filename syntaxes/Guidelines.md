# Guidelines in Markup the Elm Language

1. Core modules and functions get minimal special treatment. They're just functions and types like everybody else!
2. `Modules`, `Types`, and `Constructors` should all be flagged differently.
3. Type parameters should be uniquely flagged.
4. Top level values should be able to be emphasized.
5. Debug module name gets it's own classification because it is temporary by nature and so could be flagged visually.
6. There are only a handful of infix operators, let's flag them specifically.
7. Setting fields in a record could be allowed to have some distinction.


## Actual Categorizations

In making the TextMate file, it can be hard to track the classification of each thing.  Here's an overview.


**Modules** -> `support.other.module.elm`
**Types** -> `storage.type.elm`
**Constructors** -> `constant.other.elm`
**Top level** -> `entity.name.function.top_level.elm`
**Strings** -> `string.quoted.double.elm` and        `string.quoted.triple.elm`
**Record Fields** -> `record.field.name.elm`
**Comments** -> `comment.block.elm`  and `comment.line.double-dash.elm`
**Int Value** -> `constant.numeric.elm`
**Float Value** -> `constant.numeric.float.elm`
**Infix** -> `keyword.operator.function.infix.elm`

## Punctuation

`punctuation.separator.comma.elm`
`punctuation.bracket.elm`



