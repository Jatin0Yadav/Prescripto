import React, { useState } from 'react'
import { assets } from '../assets/assets'
import { useContext } from 'react'
import { AppContext } from '../contexts/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
const myprofile = () => {

  const { userData, setUserData, token, backendUrl, loadUserProfileData } = useContext(AppContext)
  const [isEdit, setIsEdit] = useState(false)
  const [image,setImage] = useState(false)
  const updateUserProfileData = async () => {
    try {
      const formData = new FormData()
      // Add userId from userData
      formData.append('userId', userData._id)
      formData.append('name', userData.name || '')
      formData.append('phone', userData.phone || '')
      
      // Ensure address object exists and is properly structured
      const address = {
        line1: userData.address?.line1 || '',
        line2: userData.address?.line2 || ''
      }
      formData.append('address', JSON.stringify(address))
      
      // Ensure all required fields are present
      formData.append('gender', userData.gender || '')
      formData.append('dob', userData.dob && userData.dob !== 'Not Selected' ? userData.dob : '')

      if (image) {
        formData.append('image', image)
      }

      console.log('Updating profile with data:', Object.fromEntries(formData.entries())); // Debug log

      const {data} = await axios.post(
        backendUrl+'/api/user/update-profile',
        formData,
        {
          headers: {
            token,
            'Accept': 'application/json',
          }
        }
      )
      
      if(data.success){
        await loadUserProfileData() // Reload user data first
        toast.success(data.message)
        setIsEdit(false)
        setImage(false)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log('Update profile error:', error.response?.data || error)
      toast.error(error.response?.data?.message || error.message)
    }
  }
  

  return userData && (
    <div className='max-w-lg flex flex-col gap-2 text-sm'>


    {
      isEdit
      ? <label htmlFor="image" >
        <div className='inline-block relative cursor-pointer'>
          <img className='w-36 rounded opacity-75' src={image ? URL.createObjectURL(image) : userData.image} alt="" />
          <img className='w-10 absolute botttom-12 right-12' src={image ? null : assets.upload_icon} alt="Upload" />
        </div>
        <input onChange={(e) => setImage(e.target.files[0])} type="file" id="image" hidden/>
      </label>
      : <img className='w-36 rounded' src={userData.image || null} alt="Profile" />
    }

      
      {
        isEdit
          ? <input className='bg-gray-50 text-3xl font-medium max-w-6- mt-4' type="text" value={userData.name} onChange={e => setUserData(prev => ({ ...prev, name: e.target.value }))} />
          : <p className='font-medium text-3xl text-neutral-800 mt-4'>{userData.name}</p>
      }
      <hr className='bg-zinc-400 h-[1px] border-none' />
      <div>
        <p className='text-neutral-500 underline mt-3'>CONTACT INFORMATION</p>
        <div className='grid grid-cols-[1fr_3fr] gap-y-2.5 mt-3 text-neutral-700'>
          <p className='font-medium'>Email id:</p>
          <p className='text-blue-500'>{userData.email}</p>
          <p className='font-medium'>Phone:</p>
          {
            isEdit ? <input className='bg-gray-100 max-w-52' type="text" value={userData.phone} onChange={e => setUserData(prev => ({ ...prev, phone: e.target.value }))} /> : <p className='text-blue-400'>{userData.phone}</p>
          }
          <p className='font-medium'>Address:</p>
          {
            isEdit
              ? <p>
                <input
                  className='bg-gray-50'
                  type="text"
                  onChange={e => setUserData(prev => ({
                    ...prev,
                    address: { ...prev.address, line1: e.target.value }
                  }))}
                  value={userData.address?.line1 || ''}
                />
                <br />
                <input
                  className='bg-gray-50'
                  type="text"
                  onChange={e => setUserData(prev => ({
                    ...prev,
                    address: { ...prev.address, line2: e.target.value }
                  }))}
                  value={userData.address?.line2 || ''}
                />
              </p>
              : <p className='text-gray-500'>{userData.address?.line1 || ''}{userData.address?.line1 && userData.address?.line2 ? ', ' : ''}<br />{userData.address?.line2 || ''}</p>
          }
        </div>
      </div>
      <div>
        <p className='text-neutral-500 underline mt-3'>BASIC INFORMATION</p>
        <div className='grid grid-cols-[1fr_3fr] gap-y-2.5 mt-3 text-neutral-700'>
          <p className='font-medium'>Gender:</p>
          {
            isEdit
              ? <select className='max-w-20 bg-gray-100' value={userData.gender} onChange={(e) => setUserData(prev => ({ ...prev, gender: e.target.value }))}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              : <p className='text-ray-400'>{userData.gender}</p>
          }
          <p className='font-medium'>Birthday:</p>
          {
            isEdit
              ? <input 
                  className='max-w-28 bg-gray-100' 
                  type="date" 
                  value={userData.dob && userData.dob !== 'Not Selected' ? userData.dob : ''}
                  onChange={(e) => {
                    const newValue = e.target.value || null;
                    setUserData(prev => ({ ...prev, dob: newValue }));
                  }} 
                />
              : <p className='text-gray-400'>{userData.dob && userData.dob !== 'Not Selected' ? userData.dob : 'Not Set'}</p>
          }
        </div>
      </div>
      <div className='mt-10'>
        {
          isEdit
            ? <button className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all' onClick={updateUserProfileData}>Save information</button>
            : <button className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all' onClick={() => setIsEdit(true)}>Edit</button>
        }
      </div>
    </div>
  )
}

export default myprofile