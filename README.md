# ES Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays toast notifications when ES alarms are triggered for the location via FMLIST

![image](https://github.com/user-attachments/assets/dc137035-6a96-453f-b6e2-30818a277990)


## Version 1.2 

- Sporadic E (ES) status indicator added

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the ESAlert.js and the ES-Alert folder with the es-alert.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3.  Configure the settings in the header of the script
4. 	Restart the server
5. 	Activate the plugin it in the settings

## Configuration options:

The following variables can be changed in the header of the es-alert.js

  // ES Alert Options 
  const OMID               = '8032';   // Enter the valid FMLIST OMID here, e.g. '1234'
  const LAST_ALERT_MINUTES = 15;       // Enter the time in minutes for displaying the last message when loading the page (default is 15)
  const USE_LOCAL_TIME     = true;    // To display in UTC/GMT, set this value to true
  const PLAY_ALERT_SOUND   = true;    // If you want a sound to play when receiving a notification, set this variable to true. Also, copy the alert.mp3 file frome the plugin folder to the ...\web\sound directory of the fmdx web server. The \sound folder still needs to be created.
 
  // ES Status Display Options
  const ES_STATUS_ENABLED = true;     // true = display on, false = display off
  const SELECTED_REGION = 'EU';       // Options: 'EU', 'NA', 'AU'


## Notes: 

To use the plugin, you need an active FMLIST account. To receive ES Alert notifications via the plugin, you must enable ES email notifications in FMLIST. You must also enter your OMID in the plugin's configuration settings. After activating the plugin as an admin using the ES Alert button, it checks every minute for notifications for the location. Long press of the ES Alert button after an alarm notification has been received opens the ES direction map. - Additionally, a Sporadic E (ES) status indicator can be added to the menu bar, displaying the MUF value. Simply set the corresponding variable in the script, as well as for the selected region (NA, EU, or AU).

## History:

### Version 1.1 

- a direction map has been integrated

### Version 1.0 

- Displays toast notifications and play sound when ES alarms are triggered
