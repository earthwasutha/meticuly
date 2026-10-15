# Production Tracker: Written Summary

## 1. Summary of the requirements
A manufacturing process runs through a fixed sequence of steps. Each step can work on several orders at
the same time and uses resources (materials, machine time, labour). The prototype needs to let users:
**create orders and advance them through the steps**, **see the orders in progress at each step**,
**see resource consumption as work moves forward**, and **get an overview of every order's status**.
Each order's progress and the resources it uses must be traceable.

## 2. From requirements to functional specification
| Requirement | Functional specification (rules I defined) |
|---|---|
| Defined sequence of steps | A **Step** has a `position`. An order can only move to the next position, so steps cannot be skipped. Steps can be added, edited, reordered, and given a capacity. |
| Each step handles one or more orders at once | `capacity` limits how many orders a step can hold at the same time (empty means unlimited). A step that is full blocks new orders with a clear message. |
| Each step uses resources | Each step lists the resources it needs **per unit** of an order (its bill of resources). Consumption = quantity per unit × order quantity, deducted **when the order enters the step**, which is when the material is issued to the floor. |
| Resource types | **Resource** has a type (Material / Machine / Labour) and a unit. Stock can be *limited* (a shortage blocks the step) or *not limited* (usage is recorded but never blocks, which suits machine hours and labour). A reorder level marks low stock. |
| Create and advance orders | Order life cycle: `PENDING → IN_PROGRESS (step 1…n) → COMPLETED`, and `CANCELLED` from any open state. One **Advance** action covers start, move, and complete. A preview shows the next step, the resources needed, and any blockers before you confirm. |
| Traceability | Append-only records: **OrderStepLog** (entered and exited time for each step), **ResourceTransaction** ledger (every consume, restock, and adjustment, with the balance after it), **OrderEvent** audit trail. |
| Overview of all orders | Dashboard with counts by status, overdue orders, load against capacity for each step, average time spent per step, a **bottleneck** flag, low-stock alerts, completions per day, and recent activity. |

Extra rules: only *pending* orders can be edited or deleted, because quantity drives consumption.
Cancelling does not return materials already consumed (they are treated as scrap). Steps or resources
that have history cannot be deleted.

## 3. Software design
- **Backend: NestJS + TypeORM + PostgreSQL.** The modules are steps, resources, orders, workflow, and overview. The transition rules are **pure functions** (`workflow/transition.rules.ts`) with unit tests, and both the preview endpoint and the real advance use them.
- **Consistency under concurrency.** Each advance runs in **one database transaction**. It closes the current step log, checks capacity and stock, deducts stock, writes the ledger, and opens the next log. Rows are locked with `SELECT … FOR UPDATE` in a fixed order (order → target step → resources by id), so two users cannot overfill a step or oversell stock, and the locks cannot deadlock. Tested with 5 simultaneous advances into 1 free slot: 1 succeeded and 4 got 409. The client sends `expectedStepId`, so a double click or an out-of-date screen cannot advance the same order twice.
- **API.** REST with validated DTOs (whitelisting, 400 on bad input). Business rule violations return 409 with a readable message. Swagger docs are at `/api/docs`.
- **Frontend: React + Tailwind.** **TanStack Query** holds all server state: caching, polling every 15 s so shop-floor screens stay current, and invalidating related views after each change. **Zustand** holds only UI state: dialog targets and filters. Server data is never copied into it. The create, advance, and cancel dialogs are global, so you can open them from the board, the list, or an order's page.

## 4. Simplified user manual
1. **Process setup**: add or reorder steps, set each step's capacity, and click *Edit resources* to set what the step uses per unit.
2. **Resources**: add materials, machines, and labour. Use *Restock* when goods arrive and the *stock count* (adjust) icon after a stock-take. The **stock ledger** lists every movement, with links to the order that caused it.
3. **New order** (sidebar or any page): enter product, quantity, priority, and an optional due date. You can tick *Start production right away*.
4. **Production board**: one column per step, with a capacity badge (e.g. `2 / 3`). Click **Start / Next step / Complete**. The dialog shows the next step and the resources it will use, and blocks the move if capacity or stock is short.
5. **Orders**: filter by status or step, or search. Open an order to see its **route timeline** (time spent at each step), its **resource consumption**, and its activity log.
6. **Overview**: totals by status, load per step with the bottleneck flagged, stock levels and low-stock alerts, and recent activity.

## 5. Summary of the software
A full-stack prototype: a NestJS/PostgreSQL API and a React/Tailwind single-page app, run with
`docker compose` and two `npm` commands (see README). It models steps, capacity, resource requirements,
and stock as explicit rules. Every state change is atomic and recorded. The seed script loads a
realistic multi-day demo through the real workflow service. Things I would add next in a production
version: authentication and user attribution in the audit trail, migrations instead of schema sync,
reserving resources when an order is created instead of when it enters a step, rework/QC-fail loops
(sending an order back a step), and end-to-end tests.

**Use of AI tools:** The prototype was built with Claude Code (an AI coding agent) working from the
assignment PDF. It proposed the domain model and rules, wrote the backend, frontend, tests and seed
data, and drafted this summary. It also ran the verification: unit tests, API checks of the capacity
and stock rules, a concurrent-advance race test, and a scripted browser walkthrough of the create,
advance and cancel flows, which found and fixed one UI bug.
*[Candidate: describe your own role here: what you reviewed, changed or decided yourself.]*
