# ES Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays toast notifications when ES alarms are triggered for the location via FMLIST

![image](https://github.com/user-attachments/assets/5d5343c0-6971-478a-b128-10db2a685622)



![image](https://github.com/user-attachments/assets/72b6ae0f-7727-48b6-bbea-29c89b7b12f7)




## Version 1.4 

- Added ES Ticker
- Switch to quickly disable the ES Ticker implemented in the web server settings

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the ESAlert.js and the ES-Alert folder with the es-alert.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3.  Configure the settings in the header of the script
4. 	Restart the server
5. 	Activate the plugin it in the settings

## Configuration options:

The following variables can be changed in the header of the es-alert.js:

    /// ES Alert and Ticker Options ///
    const OMID               = '1234';   // Enter the valid FMLIST OMID here, e.g. '1234'
    const LAST_ALERT_MINUTES = 15;       // Enter the time in minutes for displaying the last message when loading the page (default is 15)
	const LAST_TICKER_MINUTES = 15;      // Minutes to show last ticker logs (default is 15)
	const NUMBER_TICKER_LOGS = 5;	// Number of ticker logs until repetition (default is 5)
    const USE_LOCAL_TIME     = true;    // To display in UTC/GMT, set this value to true
    const PLAY_ALERT_SOUND   = true;    // If you want a sound to play when receiving a notification, set this variable to true. Also, copy the alert.mp3 file frome the plugin folder to the ...\web\sound directory of the fmdx web server. The \sound folder still needs to be created.
    
    /// ES Status Display Options ///
    const SELECTED_REGION = 'EU';       // Options: 'EU', 'NA', 'AU'

## Notes: 

To use the plugin, you need an active FMLIST account. To receive ES alarm notifications via the plugin, you must enable ES email notifications in FMLIST. You must also specify your OMID in the plugin's configuration settings. After activating the plugin as an administrator using the ES alarm button, it checks every minute for notifications for the location. A long press on the ES alarm button after receiving an alarm notification opens the ES direction map. – Additionally, a status indicator for sporadic E (ES) is displayed in the menu bar, which, for ES, shows the MUF value for the region selected in the script header (NA, EU, or AU). Hovering over the indicator informs you when the message was published. The MUF display can be deactivated using a switch in the web server options. By default, the ticker displays the last 5 logs from the last 15 minutes. The logs change every 3 seconds; clicking on them opens the log entry in the FMLIST map. The ticker can be turned on or off in the web server settings.

## History:

### Version 1.3 

- Added message duration for mouseover
- Switch to quickly disable the MUF display implemented in the web server settings

### Version 1.2 

- Sporadic E (ES) status indicator added

### Version 1.1 

- a direction map has been integrated

### Version 1.0 

- Displays toast notifications and play sound when ES alarms are triggered
