const asyncHandler = (requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next))
        .catch((err)=>next(err));
    }
}


// this utility function is designed to wrap an asynchronous request handler function, 
// ensuring that any errors thrown during its execution are properly handled and passed to the Express.js next function
//  for further error handling or logging. 


export {asyncHandler}