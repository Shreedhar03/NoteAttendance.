import React from 'react'

const Dialog = (props) => {
    return (
        <div className={`${props.dialog||'hidden'} bg-white shadow-xl rounded-xl shadow-gray-300 absolute top-40 left-0 right-0 p-3 mx-2`}>
            <p className='text-lg'>{props.message}</p>
            <div className='flex gap-2 mt-4'>
                <button type='button' className='border-2 border-red-600 text-red-600 p-2 rounded-lg text-[16px]' onClick={props.handleCancel}>Cancel</button>
                <button type='button' className='bg-[var(--primary)] text-white rounded-lg p-2 text-[16px]' onClick={props.handleSubmit}>Continue</button>
            </div>
        </div>
    )
}

export default Dialog