# Specification: Text Highlights and Annotations

## Overview

Allows readers to highlight text selections in chapter content, attach and edit notes, render inline highlights, and navigate annotations through a dedicated sidebar panel.

## Requirements

### Requirement: Selection Highlighting and Note Attachment
The reader MUST detect non-empty text selections in the markdown article container and present an annotation popover allowing the user to highlight the text or attach a note.

#### Scenario: Creating a text highlight with a note
- **Given** a user selects the text "Clean code does one thing well" in chapter 1
- **When** the user clicks "Highlight & Note" in the popover and enters note "Core principle"
- **Then** the system MUST save an annotation containing `id`, `bookId`, `chapterIndex`, `chapterId`, `text`, `note`, `color`, `range`, and `createdAt` in `athenaeum:annotations:<bookId>`.

### Requirement: Inline Highlight Rendering
The system MUST wrap highlighted text ranges in `<mark class="reader-highlight">` elements when rendering sanitized chapter content.

#### Scenario: Rendering saved highlights upon chapter load
- **Given** saved annotations exist for chapter 1 of book `"clean-code"`
- **When** chapter 1 is rendered in the reader
- **Then** the reader content MUST render matching text wrapped in styled `<mark>` elements reflecting the saved highlight color.

### Requirement: Annotation Listing and Deep Navigation
The system MUST provide a list of all annotations and notes for the current book, allowing users to jump directly to the annotated location.

#### Scenario: Navigating to an annotation from the list
- **Given** an annotation for text in chapter 3 is listed in the annotations drawer
- **When** the user clicks the annotation entry
- **Then** the reader MUST navigate to chapter 3, scroll the highlighted `<mark>` element into view, and briefly pulse the highlight.

### Requirement: Editing and Deleting Annotations
The system MUST allow editing note content and deleting highlights.

#### Scenario: Deleting a highlight
- **Given** an active highlight in chapter 1
- **When** the user clicks on the highlight `<mark>` and selects "Delete" (or deletes from annotations list)
- **Then** the system MUST remove the annotation from storage and re-render or unwrap the `<mark>` element without modifying the original markdown text.
