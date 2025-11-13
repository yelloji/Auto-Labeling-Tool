## Understanding

* Use project\_id and project\_name to identify scope

* Always include Global models and current project’s models in the dropdown

## Backend

* Extend `/api/v1/training/models` response to include `project_name` (already returning `project_id`)

* Keep include\_global=True; filter by framework+extension+task

## Frontend

* Pretrained dropdown:

  * Call training API with `projectId` (omit if empty)

  * Build two groups: Global and <Project Name>

  * Each option shows name + size tag + scope tag (Global or project\_name)

## Result

* Dropdown lists both Global and Project models, filtered correctly by task and framework, with clear scope labels

