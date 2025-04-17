# ES Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays toast notifications when ES alarms are triggered for the location via FMLIST

![image](https://github.com/user-attachments/assets/c5505af2-7b3b-4162-b68b-b474f593fd42)

## Version 1.0 

- Displays toast notifications and play sound when ES alarms are triggered

## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the ESAlert.js and the ES-Alert folder with the es-alert.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3.  Configure the settings in the header of the script
4. 	Restart the server
5. 	Activate the plugin it in the settings

## Configuration options:

The following variables can be changed in the header of the es-alert.js

	OMID               = '1234';          // Enter the valid FMLIST OMID here, e.g. '1234'
	LAST_ALERT_MINUTES = 15;              // Enter the time in minutes for displaying the last message when loading the page (default is 15)
	USE_LOCAL_TIME     = true;            // To display in UTC/GMT, set this value to true
	PLAY_ALERT_SOUND   = true;            // If you want a sound to play when receiving a notification, set this variable to true. Also, copy the alert.mp3 file to the ...\web\sound directory of the web server. The \sound folder still needs to be created.

## Notes: 

To use the plugin, you need an active FMLIST account. To receive ES Alert notifications via the plugin, you must enable ES email notifications in FMLIST. You must also enter your OMID in the plugin's configuration settings. After activating the plugin as an admin using the ES Alert button, it checks every minute for notifications for the location.

