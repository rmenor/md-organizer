# Specification: Chapter Bookmarks

## Overview

Enables readers to create, label, list, navigate to, and delete chapter-level bookmarks stored in client-side storage.

## Requirements

### Requirement: Bookmark Creation and Custom Labeling
The reader MUST provide a control allowing users to bookmark the active chapter with an optional custom label or a default timestamped title.

#### Scenario: Creating a chapter bookmark with custom label
- **Given** a user is reading chapter 4 titled "Functions" in book `"clean-code"`
- **When** the user activates the bookmark action and inputs label "Important refactoring rules"
- **Then** the system MUST store a bookmark record containing `id`, `bookId`, `chapterIndex`, `chapterId`, `label`, and `createdAt` under `athenaeum:bookmarks:<bookId>`.

#### Scenario: Toggling bookmark state in reader topbar
- **Given** chapter 4 is already bookmarked
- **When** the user views chapter 4 in the reader
- **Then** the bookmark icon in the topbar MUST reflect active state.

### Requirement: Bookmark Listing and Quick Navigation
The system MUST list all bookmarks for the active book in the reader drawer/panel and allow direct navigation.

#### Scenario: Navigating to a bookmarked chapter
- **Given** a saved bookmark for chapter 2 exists in the bookmarks list
- **When** the user clicks on the bookmark item
- **Then** the reader MUST navigate to chapter 2, close or collapse the panel if in mobile view, and render the chapter content.

### Requirement: Bookmark Deletion
The system MUST allow users to delete individual bookmarks.

#### Scenario: Removing a bookmark
- **Given** an existing bookmark in the bookmarks list
- **When** the user clicks the delete button for that bookmark
- **Then** the system MUST remove the bookmark from `localStorage`, update the bookmarks list UI, and update the topbar bookmark toggle if viewing the unbookmarked chapter.
