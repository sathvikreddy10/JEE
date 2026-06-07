# TestLab Offline Android App

A simple offline Android app for taking tests, based on the TestLab web interface.

## Features

- Fullscreen test-taking interface
- Brutalist design matching the web UI
- Timer with warnings (red at <1min, amber at <5min)
- Tab switch detection and warnings (simulated via app background/foreground)
- Multiple choice questions
- Mark for review functionality
- Skip questions
- Submit test confirmation
- Exam termination after excessive tab switches (7+)
- Offline math test questions

## UI Elements

- Header with timer, question counter, and tab switch indicator
- Question display with multiple choice options
- Navigation buttons (Previous, Skip, Next/Submit)
- Mark for review button
- Warning banners for tab switches
- Confirmation dialogs for submit/exit
- Fullscreen tab switch warning modal (first switch only)

## Test Data

The app includes a built-in offline math test with 25 questions covering:
- Calculus (derivatives, integrals)
- Mathematics (constants, formulas)
- Algebra (quadratic formula)
- Geometry (area calculations)
- Sample questions to fill remaining slots

## Build Requirements

- Android Studio Arctic Fox or later
- Minimum SDK: 24 (Android 7.0)
- Target SDK: 34 (Android 14)
- Java 8 compatibility

## Implementation Notes

This is a simplified version focusing on core test-taking functionality:
- Uses local question data instead of API calls
- Simulates tab switch detection via Activity lifecycle
- Stores answers in-memory (would use SharedPreferences/Room in production)
- Implements brutalist UI styling from the web version
- Includes visual feedback for warnings and status indicators