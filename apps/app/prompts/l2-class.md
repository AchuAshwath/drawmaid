# Class diagram details

These are safety boundaries and examples, not a closed vocabulary: use any
valid Mermaid class syntax that preserves the meaning in the source.

Draw an object model: classes, the members the source names, and relationships
whose kind the source actually states. Preserve the distinction between
inheritance, ownership and an ordinary reference; do not turn every related
pair into inheritance.

Keep the Mermaid fence converter-safe:

- Use one parser-safe identifier per class: letters, digits and underscores,
  starting with a letter. Prefer `OrderItem` or `Order_Item`, not spaces,
  punctuation or a copied generic such as `Repository<T>` in an identifier.
  Choose a clear alternative identifier when the source name needs simplifying
  and use that same identifier at every endpoint.
- Declare a class as `class Name { ... }`, with one field or method per line.
  A field can be `+String id`; a method can be `+findById(id) User`. Keep the
  member's type and name, but translate source-language syntax into this form
  rather than copying colons, semicolons or braces from pasted code.
- Use `class Name { <<interface>> ... }` or
  `class Name { <<abstract>> ... }` for those modifiers; do not use an
  `interface Name` declaration or a standalone modifier line.
- Mermaid uses `+` for public, `-` for private and `#` for protected members.
  Apply those markers when the source says public, private or protected; do
  not guess visibility when it is not stated.
- For generic types, use Mermaid's `~T~` spelling (`class Repository~T~` or a
  member type such as `List~User~`) rather than angle brackets. Keep `<|--`
  only for inheritance; do not use literal `<` or `>` for a generic there.
- Use `<|--` for inheritance or implementation, `*--` only when the source
  says the owner controls the part's lifetime, `o--` for shared aggregation,
  and `-->` for an ordinary association or dependency. Add a short `: label`
  only when it carries a stated role. Leave multiplicities out unless the
  source gives them.
- `<<interface>>` and `<<abstract>>` are useful only when the source states
  that distinction. Avoid `namespace` and package blocks because they are not
  reliably supported by the canvas converter; represent a stated grouping with
  clear names or restrained styling instead. Do not add a class or member
  merely to make the diagram look complete; preserve source-limited edits
  exactly.

Keep class diagrams unstyled: the canvas converter does not reliably accept
styling directives or inline style suffixes here. Use members, visibility,
stereotypes and relationship kinds to make High meaningfully richer than
Medium.

Keep classes and relation endpoints consistent after simplifying names. Do not
emit a second unrelated diagram for an analogy or explanatory aside. A valid,
readable unstyled diagram is better than decorative colour or an ambitious
construct that fails to convert.
