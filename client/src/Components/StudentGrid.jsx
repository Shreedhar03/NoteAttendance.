import React, { useEffect } from 'react'

const StudentGrid = (props) => {

    const handleCheck = () => {
        if(props.name===null){
            return
        }
        if (props.presentStudents.includes(props.roll)) {
            props.setPresentStudents(props.presentStudents.filter(e => e !== props.roll))
        } else {
            props.setPresentStudents([...props.presentStudents, props.roll])
        }
    }

    useEffect(()=>{
        handleCheck()
    },[])

    return (
        <>
            {
                <label htmlFor={props.id} className={`${props.presentStudents.includes(props.roll) ? 'bg-green-500' : 'bg-gray-100'} ${props.name===null && 'bg-white border-slate-200 border'} rounded-lg text-xl h-12 w-12 flex items-center justify-center`}>
                    {props.roll.slice(4)}
                </label>
            }
            <input type="checkbox" name="present" id={props.id} className='hidden' onChange={handleCheck} />
        </>
    )
}

export default StudentGrid
