import React, { useContext, useEffect } from 'react'
import feedback from '../assets/feedback.svg'
import { AppContext } from '../App'
import { useNavigate } from 'react-router-dom'
const Feedback = () => {
    const navigate=useNavigate()
    const { formValues, checkAuthState } = useContext(AppContext)
    useEffect(()=>{
        checkAuthState()
    },[])
    return (
        <section className='flex flex-col items-center px-6 h-screen justify-center gap-12'>
            <div className='flex flex-col items-center gap-2'>
                <img src={feedback} alt="feedback" />
                <h1 className='text-4xl font-semibold mt-8'>{formValues.subject}</h1>
                <h2 className='abel text-2xl font-semibold'>Attendance Updated</h2>
            </div>
            <button className='bg-[var(--primary)] p-4 w-full mt-8 rounded-lg text-white' onClick={()=>navigate('/')}>Back to Home</button>
        </section>

    )
}

export default Feedback
