## Release Bot Plan

This document is the working source of truth for the first Release bot implementation.

### Bot Role

The Release bot should act like a release preparation and export guide.

It should help the user:
- understand what this section does
- understand why only completed datasets appear here
- understand global rebalance vs dataset rebalance
- choose augmentation tools safely
- understand Release Configuration
- preview before generation
- understand past releases and release details

### Core Design Rules

- UI -> bot sync
- bot -> UI sync
- modal -> bot sync
- details view -> bot sync
- no stale bot state
- explanation-first where understanding matters
- real action buttons only where they clearly help
- no duplicate explanations under different button names

### Main Release States

#### 1. `release-empty`
- no completed datasets are available for release

#### 2. `release-ready-no-tools`
- completed datasets exist
- no transformation tools selected yet
- release config is not open

#### 3. `release-tools-added`
- one or more tools are selected
- continue button is available
- release config is not open yet

#### 4. `release-config-open`
- release configuration panel is visible

#### 5. `release-preview-open`
- preview block is visible

#### 6. `release-creating`
- release creation loading is active

#### 7. `release-download-modal`
- download modal is open after generation

#### 8. `release-details-view`
- full details page for one created release

### Important Modal and Subview States

- global rebalance
- dataset details
- dataset-specific rebalance
- rename release
- delete release
- transformation picker
- transformation tool config

### Transformation Rules

- Resize is mandatory before continuing
- Basic and Advanced transformation groups are separate
- Tool config screens share:
  - original preview
  - transformed preview
  - parameters
  - estimated combinations
  - apply transformation
- `Images per Original` is user-chosen from `1` to the dynamic maximum
- the maximum is calculated from the selected transformation schema and combinations
- the original image always counts as one output

### Release Configuration Rules

- system gives a default release name, but user can replace it
- user must press Enter to save an edited release name
- task type and export format must match logically
- preview output is the final check before generation

### Advanced Behaviors

- if app closes mid-setup, Release resumes the in-progress creation state
- after successful generation and closing the download modal, Release resets to a fresh new-release state

### First Implementation Scope

1. `release-empty`
2. `release-ready-no-tools`
3. `release-tools-added`
4. `release-config-open`
5. `release-preview-open`
6. `release-creating`
7. `release-download-modal`
8. `release-details-view`
9. basic modal awareness:
   - global rebalance
   - dataset details
   - dataset rebalance
   - rename release
   - delete release

### Later Second Pass

- transformation picker guidance
- tool-config guidance
- parameter-aware augmentation advice using:
  - `backend/core/transformation_config.py`
  - `backend/core/transformation_schema.py`
