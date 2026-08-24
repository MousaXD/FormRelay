# FormRelay JSON v1

A document contains `schema: "formrelay"`, `schema_version: 1`, page metadata, selected-form metadata, and `fields`.

Every field contains a deterministic `field_id`, `type`, nullable `name`/`dom_id`/label metadata, constraints, `options`, and `value`. AI assistants are expected to modify only `value`. The v1 constraint metadata includes `required`, `disabled`, `readonly`, `max_length`, `min`, `max`, `step`, and `pattern`. Constraint properties that do not apply to a control are `null`.

Text-like values are strings. Standalone checkbox values are booleans. Select and radio values are strings that must equal an exported option `value`. Checkbox-group values are arrays of exported option values.

`options` is `null` for text-like and standalone checkbox fields. It is an array of `{ "value", "label" }` for select, radio, and checkbox groups.

All objects are strict: unknown properties fail import validation. v0.1 supports only schema version 1.

Example:

```json
{
  "schema": "formrelay",
  "schema_version": 1,
  "page": { "title": "Example Application", "url": "https://example.com/apply" },
  "form": { "id": "application-form", "name": null },
  "fields": [
    {
      "field_id": "fr_4a810c90",
      "type": "text",
      "name": "project_name",
      "dom_id": "project-name",
      "label": "Project name",
      "description": null,
      "placeholder": "My project",
      "autocomplete": null,
      "required": true,
      "disabled": false,
      "readonly": false,
      "max_length": 120,
      "min": null,
      "max": null,
      "step": null,
      "pattern": null,
      "options": null,
      "value": ""
    }
  ]
}
```


During preview, FormRelay compares every non-`value` property against a fresh extraction. For text-like live controls it also probes the browser's native constraint validation on a detached clone, so input type, range, step, and pattern failures can be shown before approval without changing the page.
