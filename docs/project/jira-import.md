# Importing the RideShareEU backlog into Jira

`jira-backlog.csv` holds the project as a Kanban backlog: 6 epics and 61 stories,
bugs and tasks. Finished work (48 items) is in **Done**; remaining work (13
items) is in **Ready**, matching the board described in the manuscript
(Ready → Development → Test → Done).

## 1. Create the project

Create a **company-managed** project from the **Kanban** template. Jira only
keeps the epic → story links from a CSV in company-managed projects; a
team-managed project imports the items but loses those links.

## 2. Give the board the manuscript's columns

In the project's workflow, make sure these four statuses exist: **Ready**,
**Development**, **Test**, **Done**. Then, in the board settings under
Columns:

| Column | Status | WIP limit (manuscript) |
|---|---|---|
| Ready | Ready | — |
| Development | Development | max 3 |
| Test | Test | max 2 |
| Done | Done | — |

If you'd rather keep Jira's default statuses, map the CSV values during
import instead: Ready → To Do, Done → Done.

## 3. Import the CSV

1. Go to **Settings (gear) → System → External system import → CSV**.
2. Upload `jira-backlog.csv`. File encoding: **UTF-8**.
3. Choose the project from step 1.
4. Map the columns:
   - `Issue Id` → **Issue Id**
   - `Parent` → **Parent**
   - `Issue Type`, `Summary`, `Status`, `Priority`, `Description` → the fields with the same names
   - both `Labels` columns → **Labels**
5. On the value-mapping screen, check that each Status value lands on the
   status you expect, then start the import.

The parent rows (epics, IDs 1–6) come first in the file, as the importer
requires. Item IDs start at 101.

## Regenerating

The CSV was generated from the git history and the open items in the defense
brief. Edit it directly in a spreadsheet if priorities change; keep the
column order and the epics above their children.
