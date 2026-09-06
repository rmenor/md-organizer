# Specification: Reading Progress Tracking

## Overview

Tracks the reader's current chapter, scroll position, and reading completion status per book using client-side local storage. Resumes reading position on book open and displays visual progress indicators.

## Requirements

### Requirement: Progress Persistence and Restoration
The client application MUST persist reading progress for each book in `localStorage` using the key `athenaeum:progress:<bookId>` and automatically restore the last-read chapter and scroll position upon opening the book.

#### Scenario: Persisting progress during reading
- **Given** a user is reading chapter 3 of book `"clean-code"`
- **When** the user scrolls down or advances to another section
- **Then** the system MUST save the `bookId`, `chapterIndex`, `chapterId`, `scrollTop`, and `updatedAt` timestamp to local storage.

#### Scenario: Resuming last-read position
- **Given** saved progress exists for book `"clean-code"` at chapter 2 with scroll position 450px
- **When** the user opens book `"clean-code"` in the reader
- **Then** the system MUST load chapter 2, scroll to 450px, and display a temporary resume notification.

### Requirement: Completion Calculation and Visual Indicators
The system MUST calculate book completion progress based on completed chapters and display visual progress indicators in the reader header and table of contents.

#### Scenario: Displaying chapter and book progress
- **Given** a book contains 10 chapters and the user is viewing chapter 5
- **When** the table of contents drawer is opened
- **Then** the system MUST display the current chapter progress indicator (e.g., "Cap. 5 / 10") and visually distinguish read chapters from unread chapters.

### Requirement: Resilient Storage Fallback
The system MUST handle storage errors gracefully without interrupting the reading experience.

#### Scenario: Storage unavailable or quota exceeded
- **Given** `localStorage` is disabled or throws a `QuotaExceededError`
- **When** reading progress is updated
- **Then** the system MUST catch the error, maintain state in memory for the active session, and continue reading without throwing unhandled exceptions.
