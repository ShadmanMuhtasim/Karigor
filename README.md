# KARIGOR

### A Service Marketplace Platform Connecting Customers with Verified Service Workers

KARIGOR is a full-stack service marketplace platform designed to connect customers who need local services with skilled service workers such as electricians, plumbers, carpenters, mechanics, AC technicians, painters, and other professionals.

The platform is designed around a complete service-request lifecycle:

**Service Discovery → Service Request → Worker Matching → Quotation → Negotiation → Booking → Service Completion → Review**

The project is being developed as an undergraduate software engineering project using a modern, modular full-stack architecture.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Core Problem](#core-problem)
- [Project Goals](#project-goals)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Core Workflow](#core-workflow)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Architecture](#database-architecture)
- [Database-First Development](#database-first-development)
- [Core Database Entities](#core-database-entities)
- [Project Structure](#project-structure)
- [Development Roadmap](#development-roadmap)
- [Milestones](#milestones)
- [Security](#security)
- [External Services](#external-services)
- [Development Environment](#development-environment)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Environment Variables and Secrets](#environment-variables-and-secrets)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Deployment Plan](#deployment-plan)
- [Project Status](#project-status)
- [Team](#team)
- [Academic Project](#academic-project)
- [License](#license)

---

# Project Overview

KARIGOR is a service marketplace intended to make it easier for customers to find and hire skilled service workers.

Traditional service hiring often depends on personal contacts, local advertisements, or informal recommendations. This makes it difficult for customers to:

- Find suitable workers
- Compare available workers
- Evaluate worker credibility
- Describe service requirements
- Receive and compare quotations
- Negotiate prices
- Track bookings
- Communicate with workers
- Leave feedback after completing a service

KARIGOR aims to provide these capabilities through a centralized web platform.

The system supports two primary service-side users:

- **Customers** — users who request services
- **Workers** — professionals who provide services

An **Administrator** role provides platform-level management and oversight.

---

# Core Problem

The platform addresses several problems in traditional local service hiring:

1. Difficulty finding reliable service providers.
2. Lack of centralized worker information.
3. Limited ability to compare workers.
4. Informal quotation and negotiation processes.
5. Lack of structured booking management.
6. Lack of transparent reviews and ratings.
7. Difficulty communicating with workers.
8. Limited location-aware service discovery.
9. Lack of centralized administrative oversight.

KARIGOR brings these processes together into a single platform.

---

# Project Goals

The primary goals of KARIGOR are:

- Provide customers with a centralized service marketplace.
- Allow workers to create professional service profiles.
- Allow workers to list their skills and service categories.
- Allow customers to submit service requests.
- Allow workers to submit quotations.
- Support quotation negotiation and counter-offers.
- Support booking management.
- Provide location-based worker discovery.
- Provide real-time communication.
- Provide notifications for important events.
- Provide reviews and ratings.
- Provide administrative moderation and verification.
- Maintain strong database integrity through a Database-First architecture.
- Build a maintainable and extensible full-stack application.

---

# Key Features

## Customer Features

Planned customer capabilities include:

- Customer registration and login
- Customer profile management
- Service category browsing
- Worker discovery
- Worker profile viewing
- Location-aware worker search
- Service request creation
- Uploading service-related images
- Receiving worker quotations
- Comparing quotations
- Negotiating quotations
- Accepting quotations
- Booking services
- Viewing booking history
- Messaging workers
- Receiving notifications
- Reviewing completed services
- Rating workers

---

## Worker Features

Planned worker capabilities include:

- Worker registration and login
- Worker profile management
- Skill/category selection
- Service area configuration
- Hourly/service pricing
- Availability management
- Document submission
- Verification status
- Receiving service requests
- Submitting quotations
- Negotiating quotations
- Managing bookings
- Messaging customers
- Receiving notifications
- Viewing ratings and reviews
- Responding to customer reviews

---

## Administrator Features

Planned administrator capabilities include:

- Administrator authentication
- User management
- Worker verification
- Worker document review
- Service category management
- User moderation
- Review moderation
- Platform monitoring
- Administrative dashboards
- System-level oversight

---

# Core Workflow

The primary business workflow is designed around the following lifecycle:

```text
                    ┌───────────────────┐
                    │     Customer      │
                    └─────────┬─────────┘
                              │
                              ▼
                    Browse Service Category
                              │
                              ▼
                    Create Service Request
                              │
                              ▼
                    ┌───────────────────┐
                    │ Worker Discovery  │
                    │ / Matching        │
                    └─────────┬─────────┘
                              │
                              ▼
                    Workers Submit Quotes
                              │
                              ▼
                    ┌───────────────────┐
                    │   Negotiation     │
                    │ / Counter Offers  │
                    └─────────┬─────────┘
                              │
                              ▼
                       Quote Accepted
                              │
                              ▼
                           Booking
                              │
                              ▼
                       Service Complete
                              │
                              ▼
                      Review & Rating
