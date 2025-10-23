
import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModels.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import razorpay from 'razorpay'


// api to reg user

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body

        if (!name || !password || !email) {
            return res.json({ success: false, message: "Missing Details" })
        }
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "enter a valid email" })
        }
        if (password.length < 8) {
            return res.json({ success: false, message: "enter a strong password" })
        }
        // hashing user password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword
        }
        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// APi for user login

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await userModel.findOne({ email })
        if (!user) {
            return res.json({ success: false, message: 'User does not exist' })
        }
        const isMatch = await bcrypt.compare(password, user.password)
        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: 'Invalid credentials' })
        }

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


// API to get user profile data

const getProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const userData = await userModel.findById(userId).select('-password')
        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user [profile]
const updateProfile = async (req, res) => {
    try {
        const userId = req.userId; // Get userId from auth middleware
        const { name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        // Allow empty values for optional fields
        if (!name) {
            return res.json({ success: false, message: "Name is required" })
        }

        const updateData = {
            name,
            phone: phone || '',
            dob: dob || '',
            gender: gender || ''
        }

        if (address) {
            updateData.address = JSON.parse(address)
        }

        await userModel.findByIdAndUpdate(userId, updateData)

        if (imageFile) {
            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
            const imageURL = imageUpload.secure_url
            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        // Fetch updated user data to send back
        const updatedUser = await userModel.findById(userId).select('-password')
        res.json({ success: true, message: "Profile Updated", userData: updatedUser })
    } catch (error) {
        console.log('Profile update error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}



// API to book appointment

const bookAppointment = async (req, res) => {
    try {
        // userId should always come from authenticated middleware, not client body
        const userId = req.userId
        const { docId, slotDate, slotTime } = req.body

        // Basic validation
        if (!docId || !slotDate || !slotTime) {
            return res.json({ success: false, message: 'Missing required appointment details' })
        }
        if (!userId) {
            return res.json({ success: false, message: 'User not authenticated' })
        }

        const docRecord = await doctorModel.findById(docId).select('-password')
        if (!docRecord) {
            return res.json({ success: false, message: 'Doctor not found' })
        }

        if (!docRecord.available) {
            return res.json({ success: false, message: 'Doctor not available' })
        }

        let slots_booked = docRecord.slots_booked || {}

        // checking for slots availability
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot not available' })
            } else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = [slotTime]
        }

        const userData = await userModel.findById(userId).select('-password')
        if (!userData) {
            return res.json({ success: false, message: 'User not found' })
        }

        // Prepare plain objects for embedding (avoid Mongoose metadata leakage)
        const docData = docRecord.toObject()
        delete docData.password
        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // Persist updated slots
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        res.json({ success: true, message: 'Appointment booked successfully' })
    } catch (error) {
        console.log('Book appointment error:', error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend
const listAppointment = async (req, res) => {
    try {
        const userId = req.userId
        const appointments = await appointmentModel.find({ userId })
        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to cancel appointment by user
const cancelAppointment = async (req, res) => {
    try {
        const userId = req.userId  // Get userId from auth middleware instead of req.body
        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)
        if (String(appointmentData.userId) !== String(userId)) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
        //  releasing doctor slot

        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)
        let slots_booked = doctorData.slots_booked
        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)


        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment cancelled successfully' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


const razorpayInstance = new razorpay({
    key_id: process.env.RAZOR_PAY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

// API to make payment of appointment using razorpay

const paymentRazorpay = async (req, res) => {

    try {
        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or does not exist' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,

        }

        //  creation of an order
        const order = await razorpayInstance.orders.create(options)
        res.json({ success: true, order })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }



}
// API to verify payment and update appointment status

const verifyRazorpay = async (req,res) => {
    try {
        const { razorpay_order_id } = req.body

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        
        if(orderInfo.status === 'paid'){
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt,{payment: true})
            res.json({success:true,message:'Payment verified and appointment booked'})
        }
        else{
            res.json({success:false,message:'Payment not verified'})
        }
    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}


export { registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay }