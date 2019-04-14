import React, { useState, useEffect, useContext } from "react";
import ReactMapGL, { NavigationControl, Marker, Popup } from 'react-map-gl'
import { withStyles } from "@material-ui/core/styles";
import { unstable_useMediaQuery as useMediaQuery } from '@material-ui/core/useMediaQuery'
import PinIcon from './PinIcon'
import Context from '../context'
import Blog from './Blog'
import { useClient } from '../client'
import { GET_PINS_QUERY } from '../graphql/queries'
import differenceinMinutes from 'date-fns/difference_in_minutes'
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/DeleteTwoTone";
import { DELETE_PIN_MUTATION } from '../graphql/mutations'
import { Subscription } from 'react-apollo'

import { PIN_ADDED_SUBSCRIPTION, PIN_UPDATED_SUBSCRIPTION, PIN_DELETED_SUBSCRIPTION } from '../graphql/subscriptions'

const request = require('request-promise');
const INITIAL_VIEWPORT = {
  latitude: 37.7577,
  longitude: -122.4376,
  zoom: 13
}

const Map = ({ classes }) => {
  const client = useClient()
  const mobileSize = useMediaQuery('(max-width: 650px)')
  const { state, dispatch } = useContext(Context)
  useEffect(() => {
    getPins()
  }, [])
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT)
  const [userPosition, setUserPosition] = useState(null)
  useEffect(() => {
    getUserPosition()
  }, [])
  const [popup, setPopup] = useState(null)
  useEffect(() => {
    const pinExists = popup && state.pins.findIndex(pin => pin._id === popup._id) > -1
    if(!pinExists) {
      setPopup(null)
    }
  }, [state.pins.length])
  const [address, setAddress] = useState("")

  const getUserPosition = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords
        setViewport({ ...viewport, latitude, longitude })
        setUserPosition({ latitude, longitude})
      })
    }
  }

  const getPins = async () => {
    const { getPins } = await client.request(GET_PINS_QUERY)
    dispatch({ type: "GET_PINS", payload: getPins })
  }

  const handleMapClick = ({ lngLat, leftButton }) => {
    if (!leftButton) return
    if (!state.draft) {
      dispatch({ type: "CREATE_DRAFT" })
    }
    
    const [longitude, latitude] = lngLat 
    dispatch({
      type: "UPDATE_DRAFT_LOCATION",
      payload: { longitude, latitude}
    })
    console.log(state.draft)
  }

  const highlightNewPin = pin => {
    const isNewPin = differenceinMinutes(Date.now(), Number(pin.createdAt)) <= 15 
    return isNewPin ? "limegreen" : "white"
  }

  const handleSelectPin = pin => {
    setPopup(pin)
    dispatch({ type: "SET_PIN", payload: pin })
    convertCoordinates(pin.latitude, pin.longitude)
    console.log(state)
  }

  const convertCoordinates =  async (latitude, longitude) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=pk.eyJ1IjoiZmRvMTQxNSIsImEiOiJjanNybjgxN2wwd2h0NGFveHUxcGlwNnVqIn0.Cv3BFsC6p-2-0aNDomcNCg&&limit=1`

    const data = await request({url, json: true})
    console.log(data)
    const text = String(data.features[0].place_name)
    setAddress(text)
    
  }
        
 

  const isAuthUser = () => state.currentUser._id === popup.author._id

  const handleDeletePin = async pin => {
    const variables = { pinId: pin._id }
    await client.request(DELETE_PIN_MUTATION, variables)
    setPopup(null)
  }

  return (
    <div className={mobileSize ? classes.rootMobile : classes.root}>
      <ReactMapGL scrollZoom={!mobileSize} {...viewport} onClick={handleMapClick} onViewportChange={viewport => setViewport(viewport)} mapboxApiAccessToken="pk.eyJ1IjoiZmRvMTQxNSIsImEiOiJjanNybjgxN2wwd2h0NGFveHUxcGlwNnVqIn0.Cv3BFsC6p-2-0aNDomcNCg" width="100vw" height="calc(100vh - 64px)" mapStyle="mapbox://styles/mapbox/dark-v9">
        <div className={classes.navigationControl} >
          <NavigationControl onViewportChange={viewport => setViewport(viewport)}/>
        </div>

        {userPosition && (
          <Marker latitude={userPosition.latitude} longitude={userPosition.longitude} offsetLeft={-19} offsetTop={-37}>
            <PinIcon size={40} color="purple" />
          </Marker>
        )}

        {state.draft && (
          <Marker latitude={state.draft.latitude} longitude={state.draft.longitude} offsetLeft={-19} offsetTop={-37}>
            <PinIcon size={40} color="hotpink" />
          </Marker>
        )}

        {state.pins.map(pin => (
          <Marker latitude={pin.latitude} longitude={pin.longitude} offsetLeft={-19} offsetTop={-37} key={pin._id}>
            <PinIcon size={40} color={highlightNewPin(pin)} onClick={() => handleSelectPin(pin)}/>
          </Marker>
        ))}

          {popup && (
            <Popup anchor="top" latitude={popup.latitude} longitude={popup.longitude} closeOnClick={false} onClose={() => setPopup(null)}>
              <div className={classes.popupTab}><img className={classes.popupImage} src={popup.image} alt={popup.title}/></div>
              <div className={classes.popupTab} style={{"textAlign": "center"}}>
                <div style={{"width": 200}}><Typography>{address}</Typography></div>
                {isAuthUser() && (
                  <Button onClick={() => handleDeletePin(popup)}>
                    <DeleteIcon className={classes.deleteIcon} />
                  </Button>
                )}
              </div>
            </Popup>
          )}

      </ReactMapGL>
      
      <Subscription subscription={PIN_ADDED_SUBSCRIPTION} onSubscriptionData={({ subscriptionData }) => {
        const { pinAdded } = subscriptionData.data
        console.log({ pinAdded })
        dispatch({ type: "CREATE_PIN", payload: pinAdded })
      }}/>

      <Subscription subscription={PIN_UPDATED_SUBSCRIPTION} onSubscriptionData={({ subscriptionData }) => {
        const { pinUpdated } = subscriptionData.data
        console.log({ pinUpdated })
        dispatch({ type: "CREATE_COMMENT", payload: pinUpdated })
      }}/>

      <Subscription subscription={PIN_DELETED_SUBSCRIPTION} onSubscriptionData={({ subscriptionData }) => {
        const { pinDeleted } = subscriptionData.data
        console.log({ pinDeleted })
        dispatch({ type: "DELETE_PIN", payload: pinDeleted })
      }}/>

      <Blog />
    </div>
  )
};

const styles = {
  root: {
    display: "flex"
  },
  rootMobile: {
    width: "100vw",
    display: "flex",
    flexDirection: "column-reverse",
    alignItems: "center",
    flex: 1,
    marginTop: 5,
    marginBottom: 200,
    overflowY: "hidden",
  },

  navigationControl: {
    position: "absolute",
    top: 0,
    left: 0,
    margin: "1em"
  },
  deleteIcon: {
    color: "red"
  },
  popupImage: {
    padding: "0.4em",
    height: 200,
    width: 200,
    objectFit: "cover"
  },
  popupTab: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column"
  }
};

export default withStyles(styles)(Map);
