---
name: google-map
description: Implement interactive Google Maps in React applications using the official @vis.gl/react-google-maps library. Covers API configuration, Map provider setup, custom markers, and event handling for production-grade web mapping.
---

# Google Maps API for React

Integrating Google Maps into a React application requires handling the asynchronous loading of the Google Maps JavaScript API and managing the map instance within the React component lifecycle.

## Setup & Configuration

### 1. Obtain an API Key

- Go to the [Google Cloud Console](https://console.cloud.google.com/).
- Enable the **Maps JavaScript API**.
- Create credentials to get your **API Key**.
- **Pro-tip:** In production, restrict your API key to your specific web domain to prevent unauthorized usage.

### 2. Install Dependencies

We use the official library maintained by the Google Maps team for the best performance and Hooks support.

```bash
npm install @vis.gl/react-google-maps

```

---

## Method 1 — `@vis.gl/react-google-maps` (Recommended)

This method uses a `APIProvider` to wrap your application, ensuring the script is loaded only once and is accessible to all child components.

### Basic Map Implementation

```tsx
import React from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";

const API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

const App = () => (
  <APIProvider apiKey={API_KEY}>
    <div style={{ height: "500px", width: "100%" }}>
      <Map
        defaultCenter={{ lat: 53.5511, lng: 9.9937 }} // Hamburg, Germany
        defaultZoom={13}
        gestureHandling={"greedy"}
        disableDefaultUI={false}
      />
    </div>
  </APIProvider>
);

export default App;
```

---

## Adding Markers and Interactivity

To add markers or info windows, use the sub-components provided by the library.

### Custom Marker and InfoWindow

```tsx
import {
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { useState } from "react";

const MapWithMarkers = () => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoWindowShown, setInfoWindowShown] = useState(false);

  return (
    <Map
      mapId="DEMO_MAP_ID" // Required for Advanced Markers
      defaultCenter={{ lat: 40.7128, lng: -74.006 }}
      defaultZoom={10}
    >
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: 40.7128, lng: -74.006 }}
        onClick={() => setInfoWindowShown(true)}
      />

      {infoWindowShown && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setInfoWindowShown(false)}
        >
          <p>New York City</p>
        </InfoWindow>
      )}
    </Map>
  );
};
```

---

## Common Implementation Patterns

### Map Styling (Map ID)

Google now recommends using **Cloud-based Map Styling**.

1. Create a **Map ID** in the Cloud Console.
2. Style the map in the Console (no code changes needed to change colors/labels).
3. Pass the `mapId` prop to the `<Map />` component.

### Handling "Google is not defined"

The most common error in React is trying to access `window.google` before the script has loaded. Always use the `useApiIsLoaded` hook:

```tsx
import { useApiIsLoaded } from "@vis.gl/react-google-maps";

const MyComponent = () => {
  const apiIsLoaded = useApiIsLoaded();

  if (!apiIsLoaded) return <div>Loading Maps...</div>;

  // Now you can safely use google.maps.Geometry, etc.
  return <MapContent />;
};
```

---

## Component Properties Reference

| Prop              | Type       | Description                                                                  |
| ----------------- | ---------- | ---------------------------------------------------------------------------- |
| `apiKey`          | `string`   | Your Google Maps API Key.                                                    |
| `mapId`           | `string`   | Unique ID for Cloud-based styling (required for Advanced Markers).           |
| `defaultCenter`   | `object`   | Latitude and Longitude for initial view.                                     |
| `gestureHandling` | `string`   | Controls how touch/scroll affects the map (`cooperative`, `greedy`, `none`). |
| `onCameraChanged` | `function` | Callback for when the user pans or zooms.                                    |

---

## Best Practices

- **Container Dimensions:** The `Map` component inherits the size of its parent. Always ensure the parent `div` has a defined `height` (e.g., `100vh` or `500px`).
- **Environment Variables:** Never hardcode your API key. Use `process.env.REACT_APP_GOOGLE_MAPS_KEY`.
- **Advanced Markers:** Use `AdvancedMarker` instead of the legacy `Marker` for better performance and custom HTML support.

Would you like me to show you how to implement a **Places Autocomplete** search bar to go along with this map?
