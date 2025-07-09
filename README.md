# ES Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays toast notifications when ES alarms are triggered for the location via FMLIST

![ES](https://github.com/user-attachments/assets/f77d1aec-7691-47b4-a313-e6cdc9cc82dd)

![image](https://github.com/user-attachments/assets/72b6ae0f-7727-48b6-bbea-29c89b7b12f7)


## Version 2.3 

- Added variables to set the color and size of the ticker lines

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the ESAlert.js and the ES-Alert folder with the es-alert.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3.  Configure the settings in the header of the script
4. 	Restart the server
5. 	Activate the plugin it in the settings

## Configuration options:

The following variables can be changed in the header of the es-alert.js:

    /* ==== ES ALERT & MUF Info Options ================================================= */
    const OMID               = '';	  // Enter the valid FMLIST OMID here, e.g. '1234'
    const SELECTED_REGION    = 'EU';  // 'EU', 'NA', or 'AU'
    const LAST_ALERT_MINUTES = 15;    // Minutes to look back when page loads (default is 15)
    const PLAY_ALERT_SOUND   = true;  // true = play sound on new alert
    
    /* ==== ES Ticker Options ================================================= */
    const LAST_TICKER_MINUTES   = 5;		// Minutes to show last ticker logs (default is 5, maximum is 15)
    const NUMBER_TICKER_LOGS    = 5;		// Number of ticker logs until repetition (5 is default, 1 is only the latest) 
    const TICKER_ROTATE_SECONDS = 5;		// Rotate every X seconds
    const TICKER_REGIONS        = 'EUR'; 	        // 'EUR', 'NAM', 'SAM', 'AUS', 'ASI' or ITU Code of Country (D, SUI, GRC ...) or multiple entries linked 'EUR,NAM' or 'D,SUI,GRC'
    const AUTOLOGGED_ENTRIES    = true;		// displays autologged entries 
    const UPPER_ROW_FONT_SIZE  = "18px";       // e.g. "18px" (default), "16px", "20px" 
    const UPPER_ROW_COLOR      = "white";      // e.g. "orange", "yellow", "white" (default), "red" or "grey"
    const LOWER_ROW_FONT_SIZE = "14px";	// e.g. "14px" (default), "12px", "16px"
    const LOWER_ROW_COLOR 	= "grey";	// e.g. "orange", "yellow", "white", "red" or "grey" (default)
    
    /* ==== Global Options ================================================= */
    const USE_LOCAL_TIME        = true; // true = display in local time, false = UTC/GMT

## Notes: 

To use the plugin, you need an active FMLIST account. To receive ES alarm notifications via the plugin, you must enable ES email notifications in FMLIST. You must also specify your OMID in the plugin's configuration settings. After activating the plugin as an administrator using the ES alarm button, it checks every minute for notifications for the location. A long press on the ES alarm button after receiving an alarm notification opens the ES direction map. – Additionally, a status indicator for sporadic E (ES) is displayed in the menu bar, which, for ES, shows the MUF value for the region selected in the script header (NA, EU, or AU). Hovering over the indicator informs you when the message was published. The MUF display can be deactivated using a switch in the web server options. By default, the ticker displays the last 5 logs from the last 5 minutes. The logs change every 5 seconds; clicking on them opens the log entry in the FMLIST map. The ticker can be turned on or off in the web server settings. Clicking on the frequency in the ticker log switches to the web server. Clicking on the ticker heading opens the FMLIST ES page.

## Known Bugs:

If multiple regions are selected, the reverse link no longer works because FMLIST only allows one region to be displayed.

## History:

### Version 2.2 

- Multiple ticker regions are now possible (e.g., 'EUR,NAM' or 'D,SUI,GRC')
- Caching of country flags for faster loading

### Version 2.1 

- Issues with the country information ticker resolved
- Updated plugin info now in the web server setup

### Version 2.0 

- Use of the new FMLIST API for Ticker News
- New selection options (North America, South America, Asia)
- Added filter for Autolog entries

### Version 1.5b 

- Country flag added
- Reverse FMLIST link added (shows all receptions from the current region)

### Version 1.5a 

- bugfixing
- the ticker now also retrieves country-specific logs

### Version 1.5 

- ES Ticker in a new design with more information
- Frequencies in the ticker are now clickable
- Regions (EU, NA, and AU) now also apply to the ticker

### Version 1.4 

- Added ES Ticker
- Switch to quickly disable the ES Ticker implemented in the web server settings

### Version 1.3 

- Added message duration for mouseover
- Switch to quickly disable the MUF display implemented in the web server settings

### Version 1.2 

- Sporadic E (ES) status indicator added

### Version 1.1 

- a direction map has been integrated

### Version 1.0 

- Displays toast notifications and play sound when ES alarms are triggered
