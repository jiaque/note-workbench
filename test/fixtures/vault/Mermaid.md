# Mermaid 类型回归样本

## Flowchart
```mermaid
flowchart LR
  A[开始] --> B[完成]
```

## Sequence
```mermaid
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Done
```

## Class
```mermaid
classDiagram
  Note <|-- DailyNote
  Note : +String title
```

## State
```mermaid
stateDiagram-v2
  [*] --> Editing
  Editing --> Saved
  Saved --> [*]
```

## ER
```mermaid
erDiagram
  NOTE ||--o{ LINK : contains
```

## Journey
```mermaid
journey
  title Editing
  section Write
    Open note: 5: User
    Save note: 5: User
```

## Gantt
```mermaid
gantt
  dateFormat YYYY-MM-DD
  section Work
  Write :a, 2026-09-20, 2d
```

## Pie
```mermaid
pie title Notes
  "Draft" : 3
  "Done" : 7
```

## Quadrant
```mermaid
quadrantChart
  x-axis Low --> High
  y-axis Low --> High
  Note: [0.4, 0.6]
```

## Requirement
```mermaid
requirementDiagram
  requirement editing {
    id: 1
    text: Save notes
    risk: low
    verifymethod: test
  }
```

## Git
```mermaid
gitGraph
  commit
  branch feature
  checkout feature
  commit
```

## Mindmap
```mermaid
mindmap
  root((Notes))
    Work
    Personal
```

## Timeline
```mermaid
timeline
  title Notes
  2026 : Started
  2027 : Improved
```

## ZenUML
```mermaid
zenuml
  User->Editor: open()
```

## Usecase
```mermaid
usecase-beta
  actor User
  Edit(Edit note)
  User --> Edit
```

## Swimlane
```mermaid
swimlane-beta
  subgraph User
    A[Write]
  end
  subgraph Editor
    B[Save]
  end
  A --> B
```

## Sankey
```mermaid
sankey-beta
Draft,Done,5
```

## XY
```mermaid
xychart-beta
  x-axis [Mon, Tue, Wed]
  y-axis "Notes" 0 --> 10
  bar [2, 5, 7]
```

## Block
```mermaid
block-beta
  columns 2
  A B
  A --> B
```

## Packet
```mermaid
packet-beta
  0-7: "Header"
  8-15: "Data"
```

## Kanban
```mermaid
kanban
  todo[To do]
    a[Write]
  done[Done]
    b[Read]
```

## Architecture
```mermaid
architecture-beta
  service editor(server)[Editor]
  service notes(database)[Notes]
  editor:R -- L:notes
```
